/* Architecture illustrations only. All feature values are deterministic toys. */
(function () {
  'use strict';
  const detail = document.getElementById('tl-flow-detail');
  if (!detail) return;
  const root = document.createElement('div');
  root.className = 'fv'; root.id = 'tl-flow-visual';
  root.innerHTML = '<div class="fv-route" aria-label="两端与信道"><span data-zone="0">发送端 ①–⑥</span><i>→</i><span class="channel" data-zone="1">信道 ⑦</span><i>→</i><span data-zone="2">接收端 ⑧–⑪</span><i>→</i><span data-zone="3">训练 ⑫</span></div>' +
    '<div class="fv-stage"><div class="fv-field"><div class="fv-caption"><strong data-label="a"></strong><span data-shape="a"></span></div><canvas class="fv-canvas" data-canvas="a" role="img"></canvas><small data-note="a"></small></div>' +
    '<div class="fv-op"><div><span data-operation></span><span class="fv-arrow" aria-hidden="true">⟶</span></div><code data-api></code></div>' +
    '<div class="fv-field"><div class="fv-caption"><strong data-label="b"></strong><span data-shape="b"></span></div><canvas class="fv-canvas" data-canvas="b" role="img"></canvas><small data-note="b"></small></div></div>' +
    '<div class="fv-key"><span><b></b><em data-key="0"></em></span><span><b class="orange"></b><em data-key="1"></em></span></div>' +
    '<div class="fv-back" hidden aria-label="梯度从损失向发送端返回"><span>MSE 损失</span><i>←</i><span>接收端参数</span><i>←</i><span>信道输入</span><i>←</i><span>发送端参数</span></div>' +
    '<div class="fv-loss" hidden></div><div class="fv-foot">图中展开一张；B=2 表示同时处理两张。图像、特征和注意力均为示意，未使用训练权重。</div>';
  document.getElementById('tl-flow-title').after(root);
  const $ = selector => root.querySelector(selector);
  root.querySelectorAll('.fv-key em').forEach(e => e.style.fontStyle = 'normal');
  const clamp = v => Math.max(0, Math.min(1,v));
  let seed = 42;
  function rand() { seed = (1664525*seed+1013904223)>>>0; return (seed+.5)/4294967296; }
  function normal() { return Math.sqrt(-2*Math.log(rand()))*Math.cos(2*Math.PI*rand()); }
  // A tiny landscape gives the patch operation a visible spatial identity.
  const image = [], recon = [];
  for (let y=0;y<32;y++) for (let x=0;x<32;x++) {
    let rgb = y<18 ? [.23+.01*y,.57+.008*y,.83+.004*y] : [.17,.43+.008*(31-y),.28];
    if ((x-24)**2+(y-7)**2<14) rgb=[1,.82,.25];
    if (y>17-Math.max(0,10-Math.abs(x-11)*.8) && y<22) rgb=[.16,.36,.38];
    if (y>22 && Math.abs(x-17)<(y-20)*.55) rgb=[.36,.66,.78];
    image.push(rgb.map(clamp));
  }
  for(let y=0;y<32;y++) for(let x=0;x<32;x++) {
    const rgb=[0,0,0]; let count=0;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
      const xx=Math.max(0,Math.min(31,x+dx)), yy=Math.max(0,Math.min(31,y+dy));
      image[yy*32+xx].forEach((v,c)=>rgb[c]+=v); count++;
    }
    recon.push(rgb.map(v=>clamp(v/count+.018*normal())));
  }
  const symbols = Array.from({length:256},(_,i)=>.48*Math.sin(i*.42)+.25*Math.cos(i*.19)+.1*Math.sin(i*1.7));
  const rms = Math.sqrt(symbols.reduce((s,x)=>s+x*x,0)/256);
  const sent=symbols.map(x=>x/rms), noise=sent.map(()=>normal()*Math.pow(10,-10/20)), received=sent.map((v,i)=>v+noise[i]);
  const mse=image.reduce((s,p,i)=>s+p.reduce((t,v,c)=>t+(v-recon[i][c])**2,0),0)/3072;
  const rows = [
    ['原图 x','(2,3,32,32)','image','3 个颜色通道，每张 3072 个数。','本步的输出','(2,3,32,32)','image','原图由发送端持有，接收端拿不到它。','读取图像','x','图像内容','32×32 像素'],
    ['32×32 原图','(2,3,32,32)','gridImage','橙框：第 19 块，块行=2、块列=3。','64 个小块','(2,64,48)','patches','每块 4×4×3=48 个数，顺序按行排列。','切块、展平','reshape + permute','原来相邻的像素','选中 patch #19'],
    ['每块的像素向量','(2,64,48)','pixels','64 行：每行对应一个块；48 列：块内像素数。','带位置的 token','(2,64,64)','position','每行投影到 64 维，再加上这行的位置向量。','共享投影 + 位置','Linear(48,64) + pos','特征值（示意）','选中 token #19'],
    ['发送端 token','(2,64,64)','tokens','橙色行是 token #19；它可以参考所有块。','块与块的关系','每头 64×64','attention','展示一个头的关系表；共 4 头，每头 16 维。','自注意力 + FFN','输出 (2,64,64)','注意力权重（示意）','token #19 的一行'],
    ['64×64 个特征','(2,4096)','flat','把一张图的 64 个 token 展平成 4096 个数。','256 个待发符号','(2,256)','rawSymbols','经过可学习的全连接压缩；此处才限定发送预算。','学会压缩','Linear(4096,256)','待发符号','选中位置'],
    ['未归一化的符号','(2,256)','beforeNorm','柱高表示幅度；每张图单独计算自身 RMS。','归一化后的符号','(2,256)','afterNorm','同一组数整体缩放，平均平方约为 1。','统一发射功率','s = z / RMS(z)','符号幅度','同一尺度的参考线'],
    ['发送 s','(2,256)','sent','只有这 256 个实数穿过信道。','接收 y','(2,256)','noisy','固定示例 SNR_true=10 dB；同一噪声样本。','信道加噪声','y = s + n','发送波形 s','接收波形 y'],
    ['收到的 256 个数','(2,256)','received','接收端收到的是含噪符号 y。','256 + 2 个数','(2,258)','condition','橙色两格：inv=0.1、log10(inv+1e−8)≈−1。','拼接本地条件','cat([y, snr_features])','收到的符号','本地 SNR 条件'],
    ['带条件的向量','(2,258)','condition','两个条件来自 SNR_est；本例令估计值为 10 dB。','恢复成 64 个 token','(2,64,64)','tokens','先 Linear(258,4096)，再 reshape 并加接收端位置。','展开为 token','258 → 4096 → 64×64','特征值（示意）','token #19'],
    ['接收端 token','(2,64,64)','tokens','这是从含噪符号恢复的特征。','接收端块关系','每头 64×64','attention','接收端独立学习关系；整体输出仍为 (2,64,64)。','自注意力 + FFN','接收端自己的参数','注意力权重（示意）','token #19 的一行'],
    ['每块的输出像素','(2,64,48)','outPatches','token 先从 64 维变为 48 维，再经 Sigmoid。','拼回重建图 x̂','(2,3,32,32)','recon','逆排列拼图；外观仅示意，未展示模型训练效果。','投影并拼回','64 → 48 → 3×32×32','重建像素（示意）','patch #19'],
    ['训练目标 x','(2,3,32,32)','image','原图仅在训练时参与误差比较。','重建结果 x̂','(2,3,32,32)','error','橙色覆盖标出误差较大的位置；下方为梯度返回方向。','比较逐像素误差','MSE → backward()','原始像素','误差热区（示意）']
  ];
  let current=0;
  function color(rgb) {return 'rgb('+rgb.map(v=>Math.round(clamp(v)*255)).join(',')+')';}
  function paint(canvas,type) {
    const w=Math.max(120,canvas.getBoundingClientRect().width), h=canvas.getBoundingClientRect().height;
    const dpr=window.devicePixelRatio||1; canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const c=canvas.getContext('2d'); c.scale(dpr,dpr);
    const style=getComputedStyle(root), teal=style.getPropertyValue('--brand').trim(), orange=style.getPropertyValue('--orange').trim(), line=style.getPropertyValue('--line').trim();
    const rgbTypes=['image','gridImage','patches','recon','error','outPatches'];
    if(rgbTypes.includes(type)) {
      const size=Math.min(h-12,w-12), gap=type==='patches'||type==='outPatches'?3:0, cell=(size-gap*7)/32;
      const left=(w-size)/2, top=(h-size)/2, values=['recon','error','outPatches'].includes(type)?recon:image;
      for(let y=0;y<32;y++) for(let x=0;x<32;x++) {
        const px=left+x*cell+Math.floor(x/4)*gap,py=top+y*cell+Math.floor(y/4)*gap;
        c.fillStyle=color(values[y*32+x]);c.fillRect(px,py,cell+.3,cell+.3);
        if(type==='error') {const e=image[y*32+x].reduce((s,v,k)=>s+Math.abs(v-recon[y*32+x][k]),0)/3;c.fillStyle='rgba(217,119,6,'+Math.min(.85,e*5)+')';c.fillRect(px,py,cell+.3,cell+.3);}
      }
      if(['gridImage','patches','outPatches'].includes(type)) {
        if(type==='gridImage') {c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=.8;for(let i=1;i<8;i++){c.beginPath();c.moveTo(left+i*4*cell,top);c.lineTo(left+i*4*cell,top+size);c.stroke();c.beginPath();c.moveTo(left,top+i*4*cell);c.lineTo(left+size,top+i*4*cell);c.stroke();}}
        c.strokeStyle=orange;c.lineWidth=3;c.strokeRect(left+12*cell+3*gap,top+8*cell+2*gap,4*cell,4*cell);
      }
      return;
    }
    if(['pixels','position','tokens','attention','flat'].includes(type)) {
      const cols=type==='pixels'?48:64,rows=64,pad=8,cw=(w-pad*2)/cols,ch=(h-pad*2)/rows;
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        let v;
        if(type==='attention')v=Math.exp(-Math.abs(x-y)/8)*.7+.2*(1+Math.cos(x*.7+y*.1))/2;
        else if(type==='pixels'){const by=Math.floor(y/8)*4+Math.floor((x%16)/4),bx=y%8*4+x%4;v=image[by*32+bx][Math.floor(x/16)];}
        else v=(1+Math.sin(x*.37+y*.2)*Math.cos(y*.41))/2;
        c.globalAlpha=.12+.85*v;c.fillStyle=teal;c.fillRect(pad+x*cw,pad+y*ch,cw+.1,ch+.1);
      }
      c.globalAlpha=1;c.strokeStyle=orange;c.lineWidth=2;c.strokeRect(pad,pad+19*ch,w-pad*2,ch);
      if(type==='position'){c.fillStyle=orange;c.globalAlpha=.6;for(let y=0;y<64;y++)c.fillRect(pad+(y%8)*cw*8,pad+y*ch,cw,ch);c.globalAlpha=1;}
      return;
    }
    if(['beforeNorm','afterNorm'].includes(type)) {
      const values=type==='beforeNorm'?symbols:sent,mid=h/2,range=2.2;
      c.lineWidth=1;[-1,0,1].forEach(v=>{c.strokeStyle=v===0?line:orange;const yy=mid-v*(h-24)/(2*range);c.beginPath();c.moveTo(6,yy);c.lineTo(w-6,yy);c.stroke();});
      c.fillStyle=teal;values.forEach((v,i)=>{const x=6+i*(w-12)/256,dy=v*(h-24)/(range*2);c.fillRect(x,Math.min(mid,mid-dy),Math.max(1,(w-12)/256),Math.abs(dy));});return;
    }
    if(['sent','noisy','received'].includes(type)) {
      function trace(values,stroke,alpha){c.beginPath();c.strokeStyle=stroke;c.globalAlpha=alpha;c.lineWidth=1.4;values.forEach((v,i)=>{const x=8+i*(w-16)/255,y=h/2-v*(h-20)/6;i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();c.globalAlpha=1;}
      c.strokeStyle=line;c.beginPath();c.moveTo(8,h/2);c.lineTo(w-8,h/2);c.stroke();
      trace(type==='received'?received:sent,teal,type==='noisy'?.45:1);if(type==='noisy')trace(received,orange,1);return;
    }
    // A 16x16 packing of the transmitted vector. The extra two are local features.
    const pad=10,cols=16,cw=(w-2*pad)/cols,ch=(h-2*pad-(type==='condition'?14:0))/16,values=type==='rawSymbols'?symbols:received;
    values.forEach((v,i)=>{c.globalAlpha=.15+.8*Math.min(1,Math.abs(v)/2);c.fillStyle=teal;c.fillRect(pad+(i%16)*cw,pad+Math.floor(i/16)*ch,Math.max(.5,cw-1),Math.max(.5,ch-1));});c.globalAlpha=1;
    if(type==='condition'){c.fillStyle=orange;c.fillRect(pad,h-16,(w-2*pad-4)/2,7);c.fillRect(w/2+2,h-16,(w-2*pad-4)/2,7);}
    if(type==='rawSymbols'){c.strokeStyle=orange;c.lineWidth=2;c.strokeRect(pad+3*cw,pad+ch,cw,ch);}
  }
  function redraw(){const r=rows[current];paint($('[data-canvas="a"]'),r[2]);paint($('[data-canvas="b"]'),r[6]);}
  function show(i){
    current=i;const r=rows[i];
    ['a','b'].forEach((side,j)=>{const off=j*4;$('[data-label="'+side+'"]').textContent=r[off];$('[data-shape="'+side+'"]').textContent=r[off+1];$('[data-note="'+side+'"]').textContent=r[off+3];$('[data-canvas="'+side+'"]').setAttribute('aria-label',r[off]+'，'+r[off+1]+'。'+r[off+3]);});
    $('[data-operation]').textContent=r[8];$('[data-api]').textContent=r[9];
    $('[data-key="0"]').textContent=r[10];$('[data-key="1"]').textContent=r[11];
    $('.fv-key').hidden=i===0;
    root.querySelectorAll('[data-zone]').forEach(e=>e.classList.toggle('active',Number(e.dataset.zone)===(i<6?0:i===6?1:i<11?2:3)));
    $('.fv-back').hidden=i!==11;$('.fv-loss').hidden=i!==11;
    $('.fv-loss').textContent='当前这张示意图的 MSE = '+mse.toFixed(6)+'（不代表训练结果）';
    if(i===5){$('[data-note="a"]').textContent='这组示意符号 RMS='+rms.toFixed(3)+'；上下柱图使用同一幅度尺度。';$('[data-note="b"]').textContent='除以自身 RMS 后，256 个数的平均平方 = '+(sent.reduce((s,v)=>s+v*v,0)/256).toFixed(3)+'。';}
    redraw();
  }
  const observer=new ResizeObserver(redraw);observer.observe(root);
  window.JSCCFlowVisual={show};
})();
