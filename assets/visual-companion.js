/* Numeric teaching toys, not model inference or measured performance. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = (x, d=3) => Number.isInteger(x) ? String(x) : x.toFixed(d);
  const grid = (values, cols, classes=[], label='数值排列') => `<div class="jv-grid" role="group" aria-label="${label}" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${values.map((x,i)=>`<span class="jv-cell ${classes[i]||''}">${x}</span>`).join('')}</div>`;
  const node = (title, body, cls='') => `<div class="jv-node ${cls}"><b>${title}</b><small>${body}</small></div>`;
  const flow = items => `<div class="jv-flow">${items.join('<span class="jv-arrow" aria-hidden="true">→</span>')}</div>`;
  function result(id, text, bad=false) { $(id).textContent=text; $(id).classList.toggle('error',bad); }
  function pressed(parent, index) { [...$(parent).querySelectorAll('button')].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index))); }
  function stepper(prefix, count, render) {
    let step=0;
    const show=()=>{ pressed(prefix+'-tabs',step); render(step); };
    $(prefix+'-tabs').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{step=i;show();}));
    const next=$(prefix+'-next');
    if(next) next.addEventListener('click',()=>{step=(step+1)%count;show();});
    show();
  }
  function moduleFigure() {
    const descriptions=[
      '执行 net = ToyNet() 时进入 ToyNet.__init__。self 就是这个新对象；此时尚未运行 nn.Module 的初始化。',
      'super().__init__() 在同一个 self 上准备子模块、参数、缓冲区等内部登记容器。没有另外创建一个“父对象”。',
      '先创建 Linear(3,1)，其内部已有 weight 和 bias；赋给 self.fc 时，fc 被登记为 ToyNet 的子模块。',
      'net.parameters() 递归查找子模块，找到 fc.weight（1×3）与 fc.bias（1），共 4 个可训练数值。这里只登记，还没训练。'
    ];
    stepper('jv-module',4,i=>{
      $('jv-module-stage').innerHTML=flow([
        node('当前对象 self','同一个 ToyNet 对象',i===0?'active':''),
        node('父类初始化','准备 nn.Module 内部状态',i===1?'active':''),
        node('安装 fc','登记 Linear(3,1)',i===2?'active':''),
        node('查找参数','weight 3 个 ＋ bias 1 个',i===3?'active':'')
      ])+`<div class="jv-register"><b>self 的“登记簿”</b><ul>${i<1?'<li>尚未准备好：先调用 super().__init__()</li>':'<li>子模块容器：'+(i<2?'空':'fc → Linear(3,1)')+'</li><li>ToyNet 自身的直接参数容器：空</li>'}${i>=2?'<li>fc 的参数：weight (1,3)、bias (1,)</li>':''}</ul></div>`;
      result('jv-module-result',descriptions[i]);
    });
  }
  function tensorFigure() {
    let mode=0;
    const update=()=>{
      pressed('jv-tensor-tabs',mode);
      $('jv-reshape-control').hidden=mode!==0;
      let left='',right='',note='',bad=false;
      if(mode===0){
        const rows=Number($('jv-rows').value), cols=12/rows;
        left='<b class="jv-label">输入 x：形状 (12,)，一条数列</b><div class="jv-vector">'+grid(Array.from({length:12},(_,i)=>i+1),12)+'</div>';
        if(!Number.isInteger(cols)){
          right='<b class="jv-label">无法整齐排成 '+rows+' 行</b><div class="jv-register"><b>12 ÷ '+rows+' = '+fmt(cols)+'</b>维度必须是整数，不能每行装 2.4 个数。</div>';
          note='reshape('+rows+', -1)：12 ÷ '+rows+' = '+fmt(cols)+'，不能作为维度大小，会报错。总元素数必须保持 12。';bad=true;
        }else{
          right='<b class="jv-label">输出：形状 ('+rows+','+cols+')</b>'+grid(Array.from({length:12},(_,i)=>i+1),cols,Array.from({length:12},(_,i)=>'g'+Math.floor(i/cols)%4));
          note='reshape('+rows+', -1)：'+rows+' 是行数；-1 自动算成 12 ÷ '+rows+' = '+cols+'。按逻辑顺序装进新形状，数值与总数不变；这里不表示所有 reshape 都不复制内存。';
        }
      }else if(mode===1){
        left='<b class="jv-label">两个特征：形状 (2,)</b>'+grid(['0.1','−1'],2);
        right='<b class="jv-label">unsqueeze(0)：形状 (1,2)</b>'+grid(['0.1','−1'],2);
        note='只增加一根长度为 1 的轴。两个数字还是两个数字；(2,) 没有“行”轴，(1,2) 明确有 1 行、2 列。';
      }else if(mode===2){
        left='<b class="jv-label">输入：形状 (1,2)</b>'+grid(['0.1','−1'],2);
        right='<b class="jv-label">expand(3,-1)：形状 (3,2)</b>'+grid(['0.1','−1','0.1','−1','0.1','−1'],2,['g0','g0','g1','g1','g2','g2']);
        note='把长度为 1 的第 0 轴扩成 3；这里 -1 表示第 1 轴保持 2。三行共享原数据的视图，这张图把“读出来的值”展开画出，不代表复制了三份底层存储。';
      }else if(mode===3){
        left='<b class="jv-label">s：形状 (2,3)</b>'+grid([1,2,3,4,5,6],3)+'<b class="jv-label">条件：形状 (2,2)</b>'+grid(['a','b','a','b'],2,['g3','g3','g3','g3']);
        right='<b class="jv-label">cat(dim=1)：形状 (2,5)</b>'+grid([1,2,3,'a','b',4,5,6,'a','b'],5,['','','','g3','g3','','','','g3','g3']);
        note='dim=1 指列所在的轴：每张图的一行后面接两个条件，列数 3+2=5，batch 仍是 2。dim=0 则是上下叠行，含义不同。';
      }else{
        left='<b class="jv-label">s：形状 (2,2)</b>'+grid([3,4,0,2],2,['g0','g0','g1','g1'])+'<b class="jv-label">每行 RMS：形状 (2,1)</b>'+grid(['3.536','1.414'],1,['g0','g1']);
        right='<b class="jv-label">正确：每行除自己的 RMS</b>'+grid(['0.849','1.131','0','1.414'],2,['g0','g0','g1','g1'])+'<b class="jv-label">丢掉 keepdim：按列除，结果错</b>'+grid(['0.849','2.828','0','1.414'],2,['g0','g1','g0','g1']);
        note='RMS = sqrt(mean(s²,dim=1,keepdim=True))。保留 (2,1) 才会沿列复用同一行的除数；丢成 (2,) 时，广播从右对齐，恰好变成逐列除。B=k=2 时不报错，却算错。';
      }
      $('jv-tensor-stage').innerHTML='<div class="jv-cols"><div>'+left+'</div><div>'+right+'</div></div>';
      result('jv-tensor-result',note,bad);
    };
    $('jv-tensor-tabs').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{mode=i;update();}));
    $('jv-rows').addEventListener('change',update);update();
  }
  function loaderFigure() {
    let batch=0, epoch=1;
    function update(){
      const size=Number($('jv-batch-size').value), count=Math.ceil(10/size), start=batch*size, end=Math.min(10,start+size);
      $('jv-loader-stage').innerHTML='<b class="jv-label">Dataset：10 张示意图（每张 3×32×32）</b><div class="jv-batch">'+Array.from({length:10},(_,i)=>`<span class="jv-photo ${i>=start&&i<end?'active':i<start?'done':''}">图 ${i+1}</span>`).join('')+'</div>'+flow([node('DataLoader','取第 '+(start+1)+'—'+end+' 张'),node('当前 batch','('+ (end-start)+',3,32,32)'),node('一次 iteration','前向 → 反传 → 更新')]);
      result('jv-loader-result','第 '+epoch+' 个 epoch，第 '+(batch+1)+' / '+count+' 批。ceil(10/'+size+')='+count+'；最后一批 '+(10-(count-1)*size)+' 张。当前 batch 的 B='+(end-start)+'，不是始终等于 batch_size。');
      $('jv-loader-next').textContent=batch===count-1?'进入下一 epoch':'取下一批';
    }
    $('jv-batch-size').addEventListener('change',()=>{batch=0;epoch=1;update();});
    $('jv-loader-next').addEventListener('click',()=>{batch++;if(batch>=Math.ceil(10/Number($('jv-batch-size').value))){batch=0;epoch++;}update();});update();
  }
  function convFigure() {
    let mode=0, chosen=0;
    function update(){
      pressed('jv-conv-tabs',mode);pressed('jv-conv-picks',chosen);
      let left,right,note;
      if(mode===0){
        const row=Math.floor(chosen/2), col=chosen%2, all=Array.from({length:36},(_,i)=>{
          const r=Math.floor(i/6)-1,c=i%6-1;
          return r<0||r>3||c<0||c>3?0:r*4+c+1;
        });
        const cls=all.map((_,i)=>{
          const r=Math.floor(i/6),c=i%6;
          return (r>=row*2&&r<row*2+4&&c>=col*2&&c<col*2+4)?'focus':(r===0||r===5||c===0||c===5?'padding':'');
        });
        const sums=Array.from({length:4},(_,j)=>{
          const rr=Math.floor(j/2)*2,cc=j%2*2;let sum=0;
          for(let a=0;a<4;a++)for(let b=0;b<4;b++)sum+=all[(rr+a)*6+cc+b];return sum;
        });
        left='<b class="jv-label">4×4 输入，四周补 1 圈 0</b>'+grid(all,6,cls);
        right='<b class="jv-label">2×2 输出；橙框对应当前窗口</b>'+grid(sums,2,sums.map((_,j)=>j===chosen?'focus':''));
        note='单通道玩具：4×4 卷积核的权重全为 1，bias=0。stride=2，padding=1。输出边长 floor((4+2−4)/2)+1=2；选中窗口内 16 个数相加，得到输出['+row+','+col+']='+sums[chosen]+'。真实模型的核权重需要训练。';
      }else{
        const input=[1,2,3,4], output=Array(16).fill(0), touched=Array(16).fill(false);
        input.forEach((v,j)=>{const r=Math.floor(j/2),c=j%2;for(let a=0;a<4;a++)for(let b=0;b<4;b++){
          const rr=r*2-1+a,cc=c*2-1+b;
          if(rr>=0&&rr<4&&cc>=0&&cc<4){output[rr*4+cc]+=v;if(j===chosen)touched[rr*4+cc]=true;}
        }});
        left='<b class="jv-label">2×2 输入；选择一个“撒图样”的位置</b>'+grid(input,2,input.map((_,i)=>i===chosen?'focus':''));
        right='<b class="jv-label">4×4 输出；重叠处相加</b>'+grid(output,4,touched.map(v=>v?'focus':''));
        note='ConvTranspose2d 玩具：核权重全为 1、bias=0，stride=2、padding=1。每个输入向输出撒一片 4×4 图样，越界部分裁去，重叠处相加。输出边长 (2−1)×2−2+4=4；橙格是当前输入贡献到的位置，格中数字是全部输入叠加后的最终值。';
      }
      $('jv-conv-stage').innerHTML='<div class="jv-cols"><div>'+left+'</div><div>'+right+'</div></div>';
      result('jv-conv-result',note);
    }
    $('jv-conv-tabs').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{mode=i;update();}));
    $('jv-conv-picks').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{chosen=i;update();}));update();
  }
  function snrFigure() {
    function update(){
      const snr=Number($('jv-snr').value), gamma=10**(snr/10), a=1/gamma, b=Math.log10(a+1e-8), batch=2, k=Number($('jv-snr-k').value);
      $('jv-snr-value').textContent=snr+' dB';
      const pairs=[fmt(a,4),fmt(b,4)];
      $('jv-snr-stage').innerHTML=flow([node('SNR 标量',snr+' dB'),node('算两个特征','[1/γ, log₁₀(1/γ+ε)]'),node('补轴并扩展','(2,) → (1,2) → (2,2)'),node('每行末尾拼接','(2,'+k+') → (2,'+(k+2)+')')])+'<div class="jv-cols"><div><b class="jv-label">发送符号到信道</b>'+grid(['图 1：'+k+' 个','图 2：'+k+' 个'],1)+'</div><div><b class="jv-label">接收端准备的两列条件</b>'+grid([...pairs,...pairs],2,['g3','g3','g3','g3'])+'</div></div>';
      result('jv-snr-result','γ=10^('+snr+'/10)='+fmt(gamma,4)+'；两个特征为 ['+pairs.join(', ')+']（ε=1e−8，同正文代码）。B='+batch+'，k='+k+'，拼接后每行 '+(k+2)+' 个数。这两个条件由接收端已知的 SNR 计算，不会把发端的信道使用次数改成 k+2。');
    }
    $('jv-snr').addEventListener('input',update);$('jv-snr-k').addEventListener('change',update);update();
  }
  function trainingFigure() {
    const labels=['前向','算 loss','清旧梯度','反向传播','更新参数'];
    const details=[
      'x → 编码器 → 归一化 → 信道 → 解码器 → x̂。先得到重建图，同时建立可求导的计算路径。',
      'loss = MSE(x̂,x)。原图 x 是训练目标，梯度从这个标量误差开始回传；推理时接收端不需要原图。',
      'opt.zero_grad() 清掉上一次存留的参数梯度（可能设为 None）。模型权重保持不变。它也可以放在前向之前，但必须早于本次 backward。',
      'loss.backward()：loss → 解码器 → 信道 → 归一化 → 编码器，求每个可训练参数的梯度。AWGN 的固定本次噪声不妨碍对输入求导；本步还不更新权重。',
      'opt.step() 根据梯度和优化器状态更新参数。本页用 AdamW；下面小算式特意用普通 SGD 说明“梯度”和“更新”的区别，不替代 AdamW 的公式。'
    ];
    stepper('jv-train',5,i=>{
      $('jv-train-stage').innerHTML=flow(labels.map((s,j)=>node((j+1)+' · '+s,j===3?'算梯度':j===4?'改权重':'权重不更新',i===j?'active':'')))+
        '<b class="jv-label">独立的单参数 SGD 玩具：L=(w−2)²，初始 w=1，学习率 0.1</b>'+flow([node('前向与损失','w=1，L=1'),node('backward','梯度 dL/dw=−2',i===3?'active':''),node('SGD step','w=1−0.1×(−2)=1.2',i===4?'active':'')]);
      result('jv-train-result',details[i]);
    });
  }
  function metricFigure() {
    const truth=[0.2,0.4,0.6,0.8];
    function update(){
      const delta=Number($('jv-error').value), estimate=truth.map(v=>v+delta), squares=truth.map((v,i)=>(estimate[i]-v)**2), mse=squares.reduce((a,b)=>a+b,0)/4;
      const psnr=mse<1e-15?'∞':fmt(10*Math.log10(1/mse),2);
      $('jv-error-value').textContent=fmt(delta,2);
      $('jv-metric-stage').innerHTML='<div class="jv-cols"><div><b class="jv-label">原始 2×2 灰度图</b>'+grid(truth.map(v=>fmt(v,2)),2)+'<b class="jv-label">重建：每个像素都加 '+fmt(delta,2)+'</b>'+grid(estimate.map(v=>fmt(v,2)),2)+'</div><div><b class="jv-label">逐像素误差的平方</b>'+grid(squares.map(v=>fmt(v,4)),2,['g3','g3','g3','g3'])+'<p>MSE = <strong>'+fmt(mse,4)+'</strong><br>PSNR = <strong class="jv-number">'+psnr+' dB</strong></p></div></div>';
      result('jv-metric-result',delta===0?'四个像素完全相等，MSE=0，数学上的 PSNR 是正无穷。程序如使用 eps，应记录处理方式。':'误差平方平均 = '+fmt(mse,4)+'。像素峰值取 1，PSNR=10 log₁₀(1/MSE)='+psnr+' dB。这里是人为构造的误差示例，没有运行 JSCC 模型。');
    }
    $('jv-error').addEventListener('input',update);update();
  }
  function budgetFigure() {
    function update(){
      const k=Number($('jv-budget-k').value), bytes=Number($('jv-jpeg-bytes').value), rate=Number($('jv-code-rate').value), uses=Math.ceil(8*bytes/rate), max=Math.max(k,uses), available=Math.floor(k*rate/8), too=uses>k;
      $('jv-bytes-value').textContent=bytes+' 字节';
      const bar=(label,n,cls)=>'<div><div class="jv-bar-label"><span>'+label+'</span><b>'+n.toLocaleString()+' 次</b></div><div class="jv-track"><div class="jv-fill '+cls+'" style="width:'+100*n/max+'%"></div></div></div>';
      $('jv-budget-stage').innerHTML='<div class="jv-bars">'+bar('JSCC：k 个实数符号',k,'')+bar('JPEG → 比特 → BPSK',uses,'amber')+'</div>';
      result('jv-budget-result','JPEG '+bytes+' 字节 ×8'+(rate===1?'':' ÷码率 '+rate)+' = '+uses+' 次实数信道使用。JSCC 预算 '+k+' 次；'+(too?'占预算的 '+fmt(uses/k,2)+' 倍，不能列作等预算结果。':'这个人为给定的字节数在当前发送预算内。')+' 当前最多容纳 '+available+' 个完整 JPEG 字节（未计额外帧开销）。',too);
    }
    ['jv-budget-k','jv-jpeg-bytes','jv-code-rate'].forEach(id=>$(id).addEventListener(id==='jv-jpeg-bytes'?'input':'change',update));update();
  }
  function evaluationFigure() {
    const desc=[
      '训练阶段可以每批随机采 SNR，但这里对比的是同一份已训练权重。示意中的“已训练”是评测前提，不表示网页实际训练过模型。',
      '测试时分别固定 0、5、10、15、20 dB。每个点使用同一测试集；eval() 不会关掉信道中的 randn。',
      '每个 SNR 用若干次独立噪声重复测试，逐图记下 PSNR，并记录随机种子。所有重复方式和聚合顺序需要事先约定。',
      '先固定“平均逐图 PSNR”的口径：逐图求 dB 再平均。它与“先合并 MSE 再转 dB”不同；批次大小不同时不能直接平均各批均分。'
    ];
    stepper('jv-eval',4,i=>{
      $('jv-eval-stage').innerHTML=flow([node('同一份权重','冻结配置与数据划分',i===0?'active':''),node('固定 SNR 网格','0 / 5 / 10 / 15 / 20 dB',i===1?'active':''),node('独立噪声重复','每点、每图按协议记录',i===2?'active':''),node('聚合与报告','均值、波动、失败率',i===3?'active':'')])+ '<div class="jv-cols"><div><b class="jv-label">人为给定的逐图分数</b>'+grid([20,20,20,20,10],5,['','','','','g3'])+'</div><div><b class="jv-label">第一批 4 张：20 dB；末批 1 张：10 dB</b><div class="jv-number">18 dB</div><span class="jv-code">(4×20 + 1×10) ÷ 5</span></div></div>';
      result('jv-eval-result',desc[i]);
    });
  }
  function patchFigure() {
    let chosen=0;
    const groups=[0,0,1,1,0,0,1,1,2,2,3,3,2,2,3,3];
    const tokens=[[0,1,4,5],[2,3,6,7],[8,9,12,13],[10,11,14,15]];
    function update(){
      pressed('jv-patch-tabs',chosen);
      $('jv-patch-stage').innerHTML='<div class="jv-cols"><div><b class="jv-label">原图：4×4、单通道，patch=2</b>'+grid(Array.from({length:16},(_,i)=>i),4,groups.map(g=>'g'+g+(g===chosen?' focus':'')))+'</div><div><b class="jv-label">按块行优先：4 个 token，每块 4 个数</b>'+grid(tokens.flat(),4,tokens.flatMap((row,j)=>row.map(()=>'g'+j+(j===chosen?' focus':''))))+'</div></div>'+flow([node('切块前','(1,1,4,4)'),node('切块后','(1,4,4)'),node('逆排列拼回','原 4×4 排列，逐元素相同')]);
      result('jv-patch-result','第 '+chosen+' 块 = ['+tokens[chosen].join(', ')+']。先在整图里圈出 2×2，再按块内行优先展开；不能把整图直接 reshape(1,4,4) 就当作切块。颜色和橙框追踪同一批数字，整个过程没有压缩。');
    }
    $('jv-patch-tabs').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{chosen=i;update();}));update();
  }
  function attentionFigure() {
    function update(){
      const exp=Number($('jv-att-score').value), log=Math.log(exp), a=1/(1+exp),b=1-a;
      $('jv-att-score-value').textContent='r='+fmt(exp,1)+'，ln(r)='+fmt(log,3);
      const bar=(label,value)=>'<div><div class="jv-bar-label"><span>'+label+'</span><b>'+fmt(value,3)+'</b></div><div class="jv-track"><div class="jv-fill" style="width:'+value*100+'%"></div></div></div>';
      $('jv-att-stage').innerHTML='<div class="jv-cols"><div><b class="jv-label">一个 query，对两个 key</b><div class="jv-bars">'+bar('关注块 0：a₀',a)+bar('关注块 1：a₁',b)+'</div><p class="jv-code">a₀+a₁ = 1</p></div><div><b class="jv-label">V₀=[2,0]；V₁=[0,4]</b>'+grid(['2a₀ = '+fmt(2*a),'4a₁ = '+fmt(4*b)],2,['g0','g1'])+'<p class="jv-code">O = a₀V₀ + a₁V₁</p></div></div>';
      result('jv-att-result','缩放后的分数 S=[0, '+fmt(log,3)+']，softmax 得 ['+fmt(a)+', '+fmt(b)+']；输出 O=['+fmt(2*a)+', '+fmt(4*b)+']。默认第二个分数 ln(3)，得到 [0.25,0.75]，输出 [0.5,3]。这是一个 query 行的计算玩具，没有学习到的图像注意力。');
    }
    $('jv-att-score').addEventListener('input',update);update();
  }
  function diagnosisFigure() {
    const cases=[
      [['找首个尺寸变化','逐层打印 shape'],['核对 reshape','总数、B、k+2'],['核对层接口','Linear 的 in_features']],
      [['找首个非有限量','逐层查 isfinite'],['查数值边界','RMS eps / 均衡小 h'],['再查梯度与更新','梯度幅度、学习率']],
      [['确认参数被登记','parameters / requires_grad'],['确认链路未截断','detach / no_grad'],['确认执行顺序','zero_grad → backward → step']],
      [['核对像素值域','输入与 Sigmoid 都匹配'],['无噪小批拟合','先排查组装与数据'],['再恢复信道训练','记录配置与验证结果']]
    ];
    const tips=[
      '先定位第一层形状不符的位置；不要直接跳到最后一层改输出尺寸。',
      '加 eps 只能避免部分除零，不能代替定位根因；瑞利深衰落还可能放大噪声。',
      'backward 算梯度，step 才更新；另看优化器是否真的持有当前模型参数。',
      '小批拟合是排错证据，不能作为未见图片上的泛化成绩。'
    ];
    let selected=0;
    function update(){
      pressed('jv-debug-tabs',selected);
      $('jv-debug-stage').innerHTML=flow(cases[selected].map((s,i)=>node((i+1)+' · '+s[0],s[1])));
      result('jv-debug-result',tips[selected]);
    }
    $('jv-debug-tabs').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{selected=i;update();}));update();
  }
  function boot(){
    moduleFigure();tensorFigure();loaderFigure();convFigure();snrFigure();trainingFigure();
    metricFigure();budgetFigure();evaluationFigure();patchFigure();attentionFigure();diagnosisFigure();
    document.querySelectorAll('.jv').forEach(el=>el.dataset.ready='true');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
