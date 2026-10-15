# -*- coding: utf-8 -*-
"""4.8 patch / attention / Linear 预算核对；不训练图像模型。"""
import torch
from torch import nn

torch.set_num_threads(2)
for p in (2,4,8):
    rows = 32//p
    n = rows*rows
    d = 64
    flat = n*d
    for k in (128,256,512):
        encoder = nn.Linear(flat,k)
        decoder = nn.Linear(k+2,flat)
        measured = sum(w.numel() for w in encoder.parameters())
        measured += sum(w.numel() for w in decoder.parameters())
        formula = flat*k+k+(k+2)*flat+flat
        assert measured == formula
        if k == 256:
            print(f"p={p}: N={n}, scores={4*n*n}, bottleneck_params={measured}")
        for batch in (1,2):
            x = torch.arange(batch*3*32*32).reshape(batch,3,32,32)
            groups = x.reshape(batch,3,rows,p,rows,p)
            patches = groups.permute(0,2,4,1,3,5).reshape(batch,n,3*p*p)
            restored = patches.reshape(batch,rows,rows,3,p,p)
            restored = restored.permute(0,3,1,4,2,5).reshape(batch,3,32,32)
            assert torch.equal(x,restored)
print("9 budget settings and 18 RGB patch roundtrips checked.")
print("These are parameter counts, not measured PSNR or inference speed.")
