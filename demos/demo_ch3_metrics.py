"""教学演示：指标和预算，不训练模型。运行 python demo_ch3_metrics.py。"""
import numpy as np
x = np.array([0.0, 0.5, 1.0, 0.5])
x_hat = np.array([0.1, 0.4, 0.8, 0.5])
mse = np.mean((x_hat - x) ** 2)
print(f"MSE={mse:.6f}; PSNR={-10*np.log10(mse):.3f} dB")
errors = np.array([0.01, 0.1])
print(f"mean PSNR={np.mean(-10*np.log10(errors)):.3f}")
print(f"PSNR from mean MSE={-10*np.log10(errors.mean()):.3f}")
print(f"weighted image mean={(4*20+1*10)/5:.3f} dB")
jpeg_bytes = 700  # 假设实测得到 700 字节，仅用于预算算术
k = 256
print(f"JPEG BPSK uses={8*jpeg_bytes}; JSCC uses={k}; fits={8*jpeg_bytes<=k}")
assert np.isclose(mse, 0.015)
assert np.isclose(np.mean(-10*np.log10(errors)), 15)
