# -*- coding: utf-8 -*-
"""4.7 局部数值与门控梯度核对；运行 python demo_ch4_snr_gate.py。"""
import torch

tokens = torch.tensor([[[2., -1., 0., 4.],
                        [1., 3., -2., 0.5]]])
snr_est = torch.tensor([[0.]])
r = (snr_est - 10.0) / 10.0
a = torch.tensor([[1., -1., 0., 0.5]])
g = 1.0 + 0.5 * r * a
expanded = g.unsqueeze(1)
adjusted = tokens * expanded
print(g)
print(adjusted)
assert torch.allclose(adjusted, torch.tensor([[[1.,-1.5,0.,3.],[0.5,4.5,-2.,0.375]]]))
torch.manual_seed(7)
torch.set_num_threads(2)
import torch
import torch.nn as nn

d = 64
gate = nn.Sequential(
    nn.Linear(1, 16), nn.ReLU(),
    nn.Linear(16, d), nn.Tanh())
nn.init.zeros_(gate[2].weight)
nn.init.zeros_(gate[2].bias)
tokens = torch.randn(2, 64, d)
snr_est = torch.tensor([[0.], [20.]])
r = (snr_est - 10.0) / 10.0
g = 1.0 + 0.5 * gate(r)
adjusted = tokens * g.unsqueeze(1)
print(adjusted.shape)
print(torch.allclose(adjusted, tokens))

# 本文件只验证局部机制；没有图像数据集、JSCC 模型或性能结果。
assert torch.allclose(adjusted, tokens)
assert sum(p.numel() for p in gate.parameters()) == 1120
print("Gate parameter count:", 1120)

# 第一轮：末层零初始化，首层梯度为零是正常行为。
optimizer = torch.optim.SGD(gate.parameters(), lr=0.1)
loss = adjusted.square().mean()
optimizer.zero_grad()
loss.backward()
assert all(p.grad is not None and torch.isfinite(p.grad).all() for p in gate.parameters())
assert gate[2].weight.grad.abs().sum() > 0
assert torch.count_nonzero(gate[0].weight.grad) == 0
optimizer.step()

# 第二轮：末层已改变，前一层也应能接到梯度。
g = 1.0 + 0.5 * gate(r)
adjusted = tokens * g.unsqueeze(1)
optimizer.zero_grad()
adjusted.square().mean().backward()
assert gate[0].weight.grad.abs().sum() > 0
assert torch.isfinite(g).all() and (g > 0.5).all() and (g < 1.5).all()
print("Two-step gradient propagation:", True)

# B=1/2/3, N=2/7/64：防止某个相等尺寸恰好掩盖广播错误。
for batch in (1, 2, 3):
    for count in (2, 7, 64):
        t = torch.arange(batch*count*64, dtype=torch.float32).reshape(batch,count,64)
        estimate = torch.linspace(0,20,batch).reshape(batch,1)
        gains = 1.0 + 0.5 * gate((estimate-10)/10)
        result = t * gains.unsqueeze(1)
        for b in range(batch):
            for j in range(count):
                assert torch.allclose(result[b,j], t[b,j]*gains[b])
print("Per-image broadcasting: 9 shapes checked")

# 21 个手工SNR档位，与网页交互使用同一条公式。
for estimate in range(21):
    rr = (estimate-10)/10
    gains = 1+0.5*rr*torch.tensor([1.,-1.,0.,0.5])
    assert torch.allclose(gains[2], torch.tensor(1.))
    assert (gains >= 0.5).all() and (gains <= 1.5).all()

# 相同真实信道与噪声，改变估计值不应该改动接收向量。
torch.manual_seed(42)
s = torch.ones(2,256)
noise = torch.randn_like(s) * 10**(-10/20)
y = s+noise
frozen_y = y.clone()
for estimate in (5.,10.,15.):
    _ = gate(torch.full((2,1),(estimate-10)/10))
    assert torch.equal(y,frozen_y)
print("True SNR / estimated SNR separation:", True)
print("All local gate checks passed; no image reconstruction result.")
