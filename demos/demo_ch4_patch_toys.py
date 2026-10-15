import torch

x = torch.arange(16).reshape(1, 1, 4, 4)
grouped = x.reshape(1, 1, 2, 2, 2, 2)
ordered = grouped.permute(0, 2, 4, 1, 3, 5)
patches = ordered.reshape(1, 4, 4)
print(patches)

back = patches.reshape(1, 2, 2, 1, 2, 2)
back = back.permute(0, 3, 1, 4, 2, 5)
restored = back.reshape(1, 1, 4, 4)
print(torch.equal(x, restored))
assert torch.equal(x, restored)
# RGB 全尺寸的切块与逆变换；只验证索引，没有编解码网络。
x = torch.arange(2*3*32*32).reshape(2,3,32,32)
patches = x.reshape(2,3,8,4,8,4).permute(0,2,4,1,3,5).reshape(2,64,48)
back = patches.reshape(2,8,8,3,4,4).permute(0,3,1,4,2,5).reshape(2,3,32,32)
assert torch.equal(x,back)
print("RGB patches:", patches.shape, "roundtrip:", torch.equal(x,back))
torch.manual_seed(42)
block = torch.nn.TransformerEncoderLayer(64,4,128,dropout=0.0,batch_first=True,norm_first=True)
tokens = torch.randn(2,64,64,requires_grad=True)
result = block(tokens)
result.square().mean().backward()
assert result.shape == (2,64,64)
assert torch.isfinite(tokens.grad).all() and tokens.grad.abs().sum()>0
print("Attention shape:", result.shape, "finite nonzero gradient:", True)
