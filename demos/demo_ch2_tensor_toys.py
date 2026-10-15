# -*- coding: utf-8 -*-
# 跑码件 2 · 张量操作玩具 —— 第 2 章代码卡里每个张量操作，单独拆出来玩
# 运行：python demo_ch2_tensor_toys.py
# 注意：这里没有任何网络结构代码——V0 的模型你自己写（协作协议）。
#       本文件只负责让你「先信张量操作的行为」，写模型时不被形状报错绊住。
import torch

print("=" * 52)
print("1) reshape 与 -1（编码器展平那行）")
print("=" * 52)
x = torch.arange(24).float().reshape(2, 3, 4)   # 24 个数排成 (2,3,4)
print("  x.shape =", tuple(x.shape))
h = x.reshape(2, -1)          # -1 = 这一维自动算：24/2 = 12
print("  x.reshape(2,-1).shape =", tuple(h.shape), "   <- 自动算出 12")

print()
print("=" * 52)
print("2) unsqueeze / expand（SNR 特征拼进 batch 的两步，算法 2-2）")
print("=" * 52)
feat = torch.tensor([0.1, -1.0])            # 两个 SNR 特征
print("  feat.shape =", tuple(feat.shape), "        (2,)")
fb = feat.unsqueeze(0)                       # 插出一个 batch 维
print("  feat.unsqueeze(0).shape =", tuple(fb.shape), "     (1,2)")
fb8 = fb.expand(8, -1)                       # -1 = 这维保持 2 不动，复制成 8 行
print("  .expand(8,-1).shape =", tuple(fb8.shape), "    (8,2)，8 个样本共享同一组特征")
print("  expand 不复制内存（改 fb8[0] 会牵连全部行），只读用法没问题")

print()
print("=" * 52)
print("3) cat 拼接（k 个符号 + 2 个 SNR 特征 = k+2）")
print("=" * 52)
s = torch.zeros(8, 5)        # 假装 8 个样本、k=5 个符号
z = torch.cat([s, fb8], dim=1)
print("  cat([s(8,5), feat(8,2)], dim=1).shape =", tuple(z.shape), "  <- (8,7)，k+2 的来历")

print()
print("=" * 52)
print("4) keepdim（功率归一化那行，算法 1-1）")
print("=" * 52)
a = torch.tensor([[3.0, 4.0],
                  [1.0, 2.0]])
ms = torch.mean(a ** 2, dim=1)                # 不加 keepdim
ms_k = torch.mean(a ** 2, dim=1, keepdim=True)  # 加 keepdim
print("  a^2 按行均值  =", ms.tolist(),       "shape", tuple(ms.shape),    " <- 丢了列维")
print("  加 keepdim   =", ms_k.tolist(),     "shape", tuple(ms_k.shape), " <- 保住 (2,1)")
print("  忘了 keepdim 会怎样？(2,2) ÷ (2,) —— 不报错！按列广播：")
print("  a / ms =", [(round(v, 3)) for v in (a / ms).flatten().tolist()])
print("     ^ 第一行本该是 [0.24, 0.32]（都除以 12.5），实际 [0.24, 1.6]（4 被除以了 2.5）")
print("     悄无声息地错——这就是 power_norm 里 keepdim=True 必须写的原因")
print("  a / ms_k =", [[round(v, 3) for v in row] for row in (a / ms_k).tolist()], " <- 逐行除，正确")

print()
print("=" * 52)
print("5) 十个 batch 的 epoch 有多大（2.0.3 的 epoch/batch/iteration 辨析）")
print("=" * 52)
n_imgs, batch = 50000, 256
import math
iters = math.ceil(n_imgs / batch)
print(f"  CIFAR-10 训练集 {n_imgs} 张，batch_size={batch}")
print(f"  -> 1 个 epoch = {iters} 次 iteration（最后一批只有 {n_imgs % batch} 张）")
