/* Shape/budget and hand-set gate demonstrations; no trained image model. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = value => value.toLocaleString("en-US");
  const flow = [
    ["原图", "(B,3,32,32)", "x：每张图有 3×32×32=3072 个像素分量，值域 [0,1]。", "发送端拥有原图。B 是图片数，后续示例取 B=2。"],
    ["切成 patch", "(B,64,48)", "每行 8 块，共 64 块；每块 3×4×4=48 个数。只重排坐标，没有丢数据。", "这里的 token 还只是展平的小块，尚未过投影层。"],
    ["投影与位置", "(B,64,64)", "每块共享 Linear(48,64)，再加形状 (1,64,64) 的发送端位置表。", "这里的两个 64 分别是块数 N 和特征宽度 d，恰好相等。"],
    ["发送端注意力", "(B,64,64)", "4 个头，每头 16 维。每个头都算 64×64 的图块关系表。", "各层是独立参数的 Pre-LN 自注意力块；内部残差只在发送端内部流动。"],
    ["压成发送数", "(B,4096) → (B,256)", "展平后用 Linear(4096,256)。k=256 才是真正的信道预算。", "投影到 token 时维度变大不矛盾：压缩发生在这里。"],
    ["功率归一化", "(B,256)", "每张图的 256 个符号按自身 RMS 归一化，平均平方约为 1。", "不能把整个 batch 混着归一化，也不能用增大发射幅度抵消噪声。"],
    ["通过信道", "(B,256) → (B,256)", "AWGN：y=s+n。实数约定下 σ=10^(−SNR_true/20)。", "橙框是两端的边界。只有这 256 个数通过它；随机噪声仍允许对 s 求梯度。"],
    ["拼接接收条件", "(B,256) → (B,258)", "接收端拼入由 SNR_est 计算的两个条件特征，沿用第 2 章接口。", "理想实验设 SNR_est=SNR_true。条件由本地估计或约定获得，不能偷用原图信息。"],
    ["恢复 token", "(B,258) → (B,4096) → (B,64,64)", "Linear(258,4096) 后 reshape，再加接收端自己的位置表。", "4.7 的可选 SNR 门控放在这里，位于第一个接收端注意力块之前。"],
    ["接收端注意力", "(B,64,64)", "只根据收到的信息混合各块特征，使用接收端自己的参数。", "通信 decoder 可以由 TransformerEncoderLayer 构成；没有翻译模型的因果遮罩要求。"],
    ["还原像素", "(B,64,48) → (B,3,32,32)", "每块共享 Linear(64,48)，经 Sigmoid 后按逆排列拼回整图。", "这是学出来的重建，不是编码器的精确逆函数。"],
    ["误差与反传", "MSE：一个标量", "训练时用重建图与原图计算 MSE，再沿解码器、信道、编码器反向传播。", "原图作为训练目标是允许的；部署时它不能作为接收端输入。"]
  ];
  function initFlow() {
    if (!$('tl-flow-buttons')) return;
    let current = 0;
    const buttons = flow.map((row, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tl-step' + (i === 6 ? ' channel' : '');
      button.innerHTML = '<small>STEP ' + String(i + 1).padStart(2,'0') + '</small>' + row[0];
      button.setAttribute('aria-controls','tl-flow-detail');
      button.addEventListener('click', () => show(i));
      $('tl-flow-buttons').appendChild(button); return button;
    });
    function show(i) {
      current = i;
      buttons.forEach((button, j) => button.setAttribute('aria-pressed', String(i === j)));
      $('tl-flow-title').textContent = (i + 1) + ' / ' + flow.length + ' · ' + flow[i][0];
      $('tl-flow-shape').textContent = flow[i][1];
      $('tl-flow-body').textContent = flow[i][2];
      $('tl-flow-caution').textContent = flow[i][3];
      if (window.JSCCFlowVisual) window.JSCCFlowVisual.show(i);
      $('tl-prev').disabled = i === 0; $('tl-next').disabled = i === flow.length - 1;
    }
    $('tl-prev').addEventListener('click', () => show(Math.max(0,current-1)));
    $('tl-next').addEventListener('click', () => show(Math.min(flow.length-1,current+1)));
    show(0);
  }
  function initGate() {
    if (!$('tl-snr')) return;
    const tokens = [[2,-1,0,4],[1,3,-2,0.5]], coefficients = [1,-1,0,0.5];
    function render() {
      const snr = Number($('tl-snr').value), r = (snr-10)/10;
      const gains = coefficients.map(a => 1 + 0.5*r*a);
      $('tl-snr-value').textContent = snr + ' dB';
      $('tl-gate-rows').innerHTML = '<tr class="tl-gain"><th>g 缩放系数</th>' + gains.map(v => '<td>'+v.toFixed(2)+'</td>').join('') + '</tr>' + tokens.map((row,j) => '<tr><th>第 '+j+' 块：输入</th>' + row.map(v => '<td>'+v.toFixed(2)+'</td>').join('') + '</tr><tr><th>第 '+j+' 块：输出</th>' + row.map((v,c) => '<td>'+(v*gains[c]).toFixed(2)+'</td>').join('') + '</tr>').join('');
      $('tl-gate-result').textContent = 'r = ('+snr+' − 10) / 10 = '+r.toFixed(2)+'；同一组 4 个系数复用于两块。输入 tokens 固定，真实信道 SNR 固定为 10 dB（σ≈0.3162）；滑块只改变接收端认为的 SNR，不重新生成噪声。';
    }
    $('tl-snr').addEventListener('input',render); render();
  }
  function initBudget() {
    if (!$('tl-patch')) return;
    function render() {
      const p=Number($('tl-patch').value), k=Number($('tl-k').value), n=(32/p)**2, d=64, flat=n*d;
      const enc=flat*k+k, dec=(k+2)*flat+flat, scores=4*n*n;
      $('tl-token-count').textContent=fmt(n)+' 个';
      $('tl-score-count').textContent=fmt(scores)+' 个';
      $('tl-param-count').textContent=fmt(enc+dec);
      $('tl-budget-result').textContent='p='+p+'：每块 '+(3*p*p)+' 个像素分量；N='+n+'，Nd='+fmt(flat)+'。发送 Linear('+flat+','+k+') 含 '+fmt(enc)+' 个参数；接收 Linear('+(k+2)+','+flat+') 含 '+fmt(dec)+' 个参数。实数使用比 k/n_source = '+k+'/3072 ≈ '+(k/3072).toFixed(5)+'。';
      $('tl-budget-warning').textContent='注意力分数数量按 B=1、h=4、单层计算，完整 batch 还要乘 B；这里只数两个瓶颈 Linear 的参数（含偏置），不包含注意力、位置表和像素投影。改变 p 或 k 会改变本教学模型的权重形状，需要重新组装和训练。';
    }
    $('tl-patch').addEventListener('change',render); $('tl-k').addEventListener('change',render); render();
  }
  function boot() { initFlow(); initGate(); initBudget(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
