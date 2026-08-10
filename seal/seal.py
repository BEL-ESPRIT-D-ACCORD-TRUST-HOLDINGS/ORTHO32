"""
seal/seal.py
Cryptographic attestation for ORTHO-32 source files.
Generates SHA-256 fingerprints, RSA-signs each, chains into WORM audit record.
Uses vault-live crypto pattern: RSA-SHA256 + append-only hash chain.
"""

import hashlib
import json
import os
import sys
import datetime
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography import x509
from cryptography.x509.oid import NameOID


ENTITY_ID = "ORTHO-32/sovereign-seal"
SEAL_DIR = Path(__file__).parent
REPO_ROOT = SEAL_DIR.parent
KEY_PATH = SEAL_DIR / "signing.key.pem"
CERT_PATH = SEAL_DIR / "signing.cert.pem"
MANIFEST_PATH = SEAL_DIR / "MANIFEST.seal.jsonl"
CHAIN_PATH = SEAL_DIR / "CHAIN.worm.jsonl"

SOURCE_EXTENSIONS = {
    '.py', '.lean', '.ml', '.sh', '.yml', '.yaml',
    '.Dockerfile', '.pl', '.toml', '.cfg',
}
SOURCE_NAMES = {
    'Makefile', 'Dockerfile', 'docker-compose.yml', 'lakefile.lean',
}


def generate_signing_key():
    """Generate RSA-2048 signing key + self-signed X.509 certificate."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    now = datetime.datetime.utcnow()
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, ENTITY_ID),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Bel Esprit D'Accord Irrevocable Trust"),
    ])

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=3650))
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=True,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .sign(private_key, hashes.SHA256())
    )

    KEY_PATH.write_bytes(private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ))

    CERT_PATH.write_bytes(cert.public_bytes(serialization.Encoding.PEM))

    print(f"[seal] Generated signing key: {KEY_PATH}")
    print(f"[seal] Generated certificate: {CERT_PATH}")
    return private_key, cert


def load_signing_key():
    """Load existing key pair or generate new one."""
    if KEY_PATH.exists() and CERT_PATH.exists():
        private_key = serialization.load_pem_private_key(
            KEY_PATH.read_bytes(), password=None
        )
        cert = x509.load_pem_x509_certificate(CERT_PATH.read_bytes())
        return private_key, cert
    return generate_signing_key()


def find_source_files():
    """Walk repo and find all source files to seal."""
    files = []
    for root, dirs, filenames in os.walk(REPO_ROOT):
        # Skip .git, seal dir, node_modules, __pycache__
        dirs[:] = [d for d in dirs if d not in {'.git', 'seal', 'node_modules', '__pycache__', '.lake'}]
        for name in sorted(filenames):
            path = Path(root) / name
            rel = path.relative_to(REPO_ROOT)
            ext = path.suffix
            if ext in SOURCE_EXTENSIONS or name in SOURCE_NAMES:
                files.append((rel, path))
    return files


def fingerprint_file(path: Path) -> str:
    """SHA-256 hash of file contents."""
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def sign_fingerprint(private_key, fingerprint: str) -> bytes:
    """RSA-SHA256 signature over the fingerprint string."""
    return private_key.sign(
        fingerprint.encode('utf-8'),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )


def seal_repository():
    """
    Main seal operation:
    1. Load/generate signing key
    2. Walk all source files
    3. SHA-256 fingerprint each
    4. RSA-sign each fingerprint
    5. Append to WORM chain
    6. Write manifest
    """
    import base64

    private_key, cert = load_signing_key()
    files = find_source_files()

    print(f"[seal] Found {len(files)} source files to seal")
    print(f"[seal] Signing entity: {ENTITY_ID}")
    print(f"[seal] Certificate CN: {cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value}")
    print()

    # WORM chain state
    prev_hash = '0' * 64
    sequence = 0

    # Load existing chain state
    if CHAIN_PATH.exists():
        lines = [l.strip() for l in CHAIN_PATH.read_text().splitlines() if l.strip()]
        if lines:
            last = json.loads(lines[-1])
            prev_hash = last['entry_hash']
            sequence = last['sequence'] + 1

    manifest_entries = []
    chain_entries = []
    timestamp = datetime.datetime.utcnow().isoformat() + 'Z'

    for rel_path, abs_path in files:
        fingerprint = fingerprint_file(abs_path)
        signature = sign_fingerprint(private_key, fingerprint)
        sig_b64 = base64.b64encode(signature).decode('ascii')

        # Manifest entry
        entry = {
            'file': str(rel_path).replace('\\', '/'),
            'sha256': fingerprint,
            'signature': sig_b64,
            'timestamp': timestamp,
            'spdx': 'BSL-1.1 AND AGPL-3.0-or-later AND MPL-2.0',
            'copyright': 'Bel Esprit D\'Accord Irrevocable Trust',
        }
        manifest_entries.append(entry)

        # WORM chain entry
        record_json = json.dumps({
            'file': entry['file'],
            'sha256': fingerprint,
            'timestamp': timestamp,
        }, sort_keys=True, separators=(',', ':'))

        entry_hash = hashlib.sha256(
            (prev_hash + record_json).encode('utf-8')
        ).hexdigest()

        chain_entry = {
            'sequence': sequence,
            'prev_hash': prev_hash,
            'entry_hash': entry_hash,
            'record': json.loads(record_json),
        }
        chain_entries.append(chain_entry)

        prev_hash = entry_hash
        sequence += 1

        print(f"  [OK] {rel_path}")
        print(f"       sha256: {fingerprint[:16]}...")

    # Write manifest
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        for entry in manifest_entries:
            f.write(json.dumps(entry, sort_keys=True, separators=(',', ':')) + '\n')

    # Append to WORM chain
    with open(CHAIN_PATH, 'a', encoding='utf-8') as f:
        for entry in chain_entries:
            f.write(json.dumps(entry, sort_keys=True, separators=(',', ':')) + '\n')

    print()
    print(f"[seal] Manifest written: {MANIFEST_PATH} ({len(manifest_entries)} entries)")
    print(f"[seal] WORM chain updated: {CHAIN_PATH} (sequence {sequence})")
    print(f"[seal] Chain head: {prev_hash[:16]}...")
    print()
    print("[seal] SEALED.")


def verify_chain():
    """Verify WORM chain integrity."""
    if not CHAIN_PATH.exists():
        print("[verify] No chain found.")
        return False

    lines = [l.strip() for l in CHAIN_PATH.read_text().splitlines() if l.strip()]
    prev_hash = '0' * 64

    for i, line in enumerate(lines):
        entry = json.loads(line)
        if entry['prev_hash'] != prev_hash:
            print(f"[verify] BROKEN at sequence {i}: prev_hash mismatch")
            return False

        record_json = json.dumps(entry['record'], sort_keys=True, separators=(',', ':'))
        expected = hashlib.sha256(
            (prev_hash + record_json).encode('utf-8')
        ).hexdigest()

        if entry['entry_hash'] != expected:
            print(f"[verify] BROKEN at sequence {i}: entry_hash mismatch")
            return False

        prev_hash = entry['entry_hash']

    print(f"[verify] Chain intact. {len(lines)} entries. Head: {prev_hash[:16]}...")
    return True


def verify_manifest():
    """Verify all file fingerprints against manifest."""
    import base64

    if not MANIFEST_PATH.exists():
        print("[verify] No manifest found.")
        return False

    cert = x509.load_pem_x509_certificate(CERT_PATH.read_bytes())
    pub_key = cert.public_key()

    lines = [l.strip() for l in MANIFEST_PATH.read_text().splitlines() if l.strip()]
    ok = 0
    failed = 0

    for line in lines:
        entry = json.loads(line)
        file_path = REPO_ROOT / entry['file']

        if not file_path.exists():
            print(f"  [MISSING] {entry['file']}")
            failed += 1
            continue

        current_hash = fingerprint_file(file_path)
        if current_hash != entry['sha256']:
            print(f"  [MODIFIED] {entry['file']}")
            print(f"             expected: {entry['sha256'][:16]}...")
            print(f"             current:  {current_hash[:16]}...")
            failed += 1
            continue

        # Verify signature
        sig_bytes = base64.b64decode(entry['signature'])
        try:
            pub_key.verify(
                sig_bytes,
                entry['sha256'].encode('utf-8'),
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
            ok += 1
        except Exception:
            print(f"  [SIG FAIL] {entry['file']}")
            failed += 1

    print(f"[verify] {ok} OK, {failed} FAILED, {ok + failed} total")
    return failed == 0


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'verify':
        print("=== ORTHO-32 SEAL VERIFICATION ===\n")
        chain_ok = verify_chain()
        print()
        manifest_ok = verify_manifest()
        print()
        if chain_ok and manifest_ok:
            print("[verify] ALL GOOD.")
            sys.exit(0)
        else:
            print("[verify] INTEGRITY VIOLATION DETECTED.")
            sys.exit(1)
    else:
        print("=== ORTHO-32 CRYPTOGRAPHIC SEAL ===\n")
        seal_repository()
