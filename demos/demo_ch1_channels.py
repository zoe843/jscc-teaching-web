# -*- coding: utf-8 -*-
# 跑码件 1 · channel 玩具 —— 只用你单元4 已经会的东西（NumPy）
# 运行：python demo_ch1_channels.py
# 作用：把第 1 章三张算法卡的每个公式跑给你看，先信公式，再写 torch 版
import numpy as np

rng = np.random.default_rng(42)   # 固定种子：你每次运行结果都一模一样

print("=" * 52)
print("1) dB 换算：sigma^2 = 10^(-SNR_dB/10)   （算法 1-2）")
print("=" * 52)
for snr_db in [0, 3, 10, 20]:
    sigma2 = 10 ** (-snr_db / 10)
    print(f"  SNR = {snr_db:>2} dB  ->  sigma^2 = {sigma2:.4f}")

print()
print("=" * 52)
print("2) 功率归一化手算验证（算法 1-1，正文 [3,4] 例子）")
print("=" * 52)
s = np.array([3.0, 4.0])
rms = np.sqrt(np.mean(s ** 2))
s_norm = s / rms
print(f"  原始符号 {s}  ->  平均功率 {np.mean(s**2):.2f}（不是 1）")
print(f"  RMS = sqrt({np.mean(s**2):.2f}) = {rms:.4f}")
print(f"  归一后 {np.round(s_norm, 3)}  ->  平均功率 {np.mean(s_norm**2):.4f}（=1 ✓）")

print()
print("=" * 52)
print("3) AWGN 实测：造 100 万个噪声点，实测功率对得上理论吗")
print("=" * 52)
snr_db = 10
sigma2 = 10 ** (-snr_db / 10)
noise = rng.normal(0, np.sqrt(sigma2), 1_000_000)
print(f"  SNR={snr_db} dB -> 理论 sigma^2 = {sigma2}")
print(f"  实测噪声平均功率 = {np.mean(noise**2):.4f}   （大数定律：样本够多就贴理论）")

print()
print("=" * 52)
print("4) 瑞利幅度：两个独立高斯合成（算法 1-3）")
print("=" * 52)
a = rng.normal(0, 1, 1_000_000)
b = rng.normal(0, 1, 1_000_000)
h = np.sqrt((a ** 2 + b ** 2) / 2)
print(f"  E[|h|^2] = {np.mean(h**2):.4f}   （理论 = 1，所以 σ² 换算不用改）")
print(f"  最小的 |h| = {h.min():.4f}   （存在深衰落：|h| 接近 0，均衡时噪声被放大 -> 这就是代价）")

print(f"  E[h] = {h.mean():.4f} （理论 sqrt(pi)/2 = {np.sqrt(np.pi)/2:.4f}）")
print(f"  P(h<0.1) = {np.mean(h<0.1):.4f} （理论 1-exp(-0.01) = {1-np.exp(-0.01):.4f}）")
