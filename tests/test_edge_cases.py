"""
ORTHO-32 Edge Case Test Suite
Tests determinism, entropy, and edge cases for the invariant transform
"""

import pytest
import torch
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent / "python"))

from ortho32_invariant import (
    invariant_transform_engine,
    InvariantTransformLayer,
    measure_entropy,
    benchmark_determinism
)
from ortho32_llm_runtime import (
    CausalSelfAttention,
    FeedForward,
    TransformerBlock,
    ORTHO32_GPT
)


class TestDeterminism:
    """Test perfect determinism (H=0.0)"""

    def test_single_vector_determinism(self):
        """Same input always produces same output"""
        x = torch.randn(128)
        y1 = invariant_transform_engine(x)
        y2 = invariant_transform_engine(x)
        assert torch.allclose(y1, y2, rtol=1e-10, atol=1e-12)

    def test_batch_determinism(self):
        """Batched inputs are deterministic"""
        x = torch.randn(8, 128)
        y1 = invariant_transform_engine(x)
        y2 = invariant_transform_engine(x)
        assert torch.allclose(y1, y2, rtol=1e-10, atol=1e-12)

    def test_100_run_determinism(self):
        """Zero variance over 100 runs"""
        x = torch.randn(64)
        is_det, variance = benchmark_determinism(x, num_runs=100)
        assert is_det
        assert variance == 0.0

    @pytest.mark.parametrize("shape", [(32,), (16, 64), (4, 8, 128)])
    def test_shape_determinism(self, shape):
        """Determinism across different tensor shapes"""
        x = torch.randn(*shape)
        y1 = invariant_transform_engine(x)
        y2 = invariant_transform_engine(x)
        assert torch.allclose(y1, y2, rtol=1e-10)


class TestEntropy:
    """Test H=0.0 entropy property"""

    def test_zero_entropy_output(self):
        """Output has H=0.0 entropy"""
        x = torch.randn(128)
        y = invariant_transform_engine(x)
        H = measure_entropy(y)
        assert H < 0.01  # Near-zero (discretization noise)

    def test_entropy_vs_random(self):
        """Transform reduces entropy compared to random"""
        x = torch.randn(128)
        y = invariant_transform_engine(x)
        H_input = measure_entropy(x)
        H_output = measure_entropy(y)
        assert H_output <= H_input


class TestBoundaryConditions:
    """Test edge cases and boundary conditions"""

    def test_zero_vector(self):
        """All-zero input"""
        x = torch.zeros(128)
        y = invariant_transform_engine(x)
        assert y.shape == x.shape

    def test_single_element(self):
        """Single-element tensor"""
        x = torch.tensor([5.0])
        y = invariant_transform_engine(x)
        assert y.shape == (1,)

    def test_large_values(self):
        """Very large values"""
        x = torch.randn(128) * 1e6
        y = invariant_transform_engine(x)
        assert torch.isfinite(y).all()

    def test_small_values(self):
        """Very small values (near zero)"""
        x = torch.randn(128) * 1e-6
        y = invariant_transform_engine(x)
        assert torch.isfinite(y).all()

    def test_negative_values(self):
        """All negative values"""
        x = -torch.abs(torch.randn(128))
        y = invariant_transform_engine(x)
        assert y.shape == x.shape


class TestLinearity:
    """Test linear transformation property"""

    def test_scaling_property(self):
        """f(2x) = 2f(x)"""
        x = torch.randn(128)
        y1 = invariant_transform_engine(x)
        y2 = invariant_transform_engine(x * 2.0)
        assert torch.allclose(y2, y1 * 2.0, rtol=1e-4)

    def test_addition_property(self):
        """f(x + y) = f(x) + f(y)"""
        x = torch.randn(128)
        y = torch.randn(128)
        f_sum = invariant_transform_engine(x + y)
        f_x = invariant_transform_engine(x)
        f_y = invariant_transform_engine(y)
        assert torch.allclose(f_sum, f_x + f_y, rtol=1e-4)


class TestGPUAcceleration:
    """Test GPU execution (if available)"""

    @pytest.mark.skipif(not torch.cuda.is_available(), reason="No CUDA")
    def test_gpu_execution(self):
        """Transform works on GPU"""
        x = torch.randn(128).cuda()
        y = invariant_transform_engine(x)
        assert y.device.type == 'cuda'

    @pytest.mark.skipif(not torch.cuda.is_available(), reason="No CUDA")
    def test_cpu_gpu_equivalence(self):
        """CPU and GPU produce identical results"""
        x = torch.randn(128)
        y_cpu = invariant_transform_engine(x)
        y_gpu = invariant_transform_engine(x.cuda()).cpu()
        assert torch.allclose(y_cpu, y_gpu, rtol=1e-5)


class TestLLMIntegration:
    """Test LLM runtime integration"""

    def test_attention_forward(self):
        """Attention with ORTHO-32 works"""
        attn = CausalSelfAttention(d_model=128, num_heads=4, use_ortho32=True)
        x = torch.randn(2, 16, 128)  # (batch, seq_len, d_model)
        y = attn(x)
        assert y.shape == x.shape

    def test_feedforward_forward(self):
        """FFN with ORTHO-32 works"""
        ff = FeedForward(d_model=128, use_ortho32=True)
        x = torch.randn(2, 16, 128)
        y = ff(x)
        assert y.shape == x.shape

    def test_transformer_block(self):
        """Complete transformer block works"""
        block = TransformerBlock(d_model=128, num_heads=4, use_ortho32=True)
        x = torch.randn(2, 16, 128)
        y = block(x)
        assert y.shape == x.shape

    def test_gpt_forward(self):
        """Complete GPT model works"""
        model = ORTHO32_GPT(
            vocab_size=256,
            d_model=128,
            num_layers=2,
            num_heads=4,
            use_ortho32=True
        )
        idx = torch.randint(0, 256, (2, 16))
        logits, _ = model(idx)
        assert logits.shape == (2, 16, 256)

    def test_gpt_generation(self):
        """Token generation works"""
        model = ORTHO32_GPT(
            vocab_size=256,
            d_model=128,
            num_layers=2,
            num_heads=4,
            use_ortho32=True
        )
        model.eval()
        start_ids = torch.zeros((1, 1), dtype=torch.long)
        generated = model.generate(start_ids, max_new_tokens=10, temperature=1.0)
        assert generated.shape[1] == 11  # 1 start + 10 generated


class TestModuleWrapper:
    """Test PyTorch nn.Module wrapper"""

    def test_module_forward(self):
        """Module wrapper works"""
        layer = InvariantTransformLayer()
        x = torch.randn(4, 64)
        y = layer(x)
        assert y.shape == x.shape

    def test_module_in_sequential(self):
        """Works in nn.Sequential"""
        model = torch.nn.Sequential(
            torch.nn.Linear(64, 64),
            InvariantTransformLayer(),
            torch.nn.ReLU()
        )
        x = torch.randn(4, 64)
        y = model(x)
        assert y.shape == x.shape


class TestEdgeCaseCombinations:
    """Test combinations of edge cases"""

    def test_zero_then_nonzero(self):
        """Zero input followed by non-zero"""
        layer = InvariantTransformLayer()
        x1 = torch.zeros(4, 64)
        x2 = torch.randn(4, 64)
        y1 = layer(x1)
        y2 = layer(x2)
        assert y1.shape == x1.shape
        assert y2.shape == x2.shape

    def test_batch_size_one(self):
        """Batch size of 1"""
        x = torch.randn(1, 128)
        y = invariant_transform_engine(x)
        assert y.shape == (1, 128)

    def test_very_long_sequence(self):
        """Very long sequence length"""
        x = torch.randn(2, 4096)
        y = invariant_transform_engine(x)
        assert y.shape == (2, 4096)


# ============================================================================
# TEST RUNNER
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
