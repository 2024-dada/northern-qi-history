(() => {
  'use strict';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const refs={
    yang:{title:'《北史》卷七；《北齐书》卷四',url:'https://www.shidianguji.com/book/LS0011/chapter/LS0011_9',extra:'https://www.shidianguji.com/book/SK0722'},
    kings:{title:'《北齐书》卷十二 · 宗室诸王',url:'https://www.shidianguji.com/book/HY2035/chapter/1knzr0dqogf1i',extra:'https://zh.wikisource.org/wiki/北齊書/卷12'},
    wei:{title:'《北史》卷八 · 齐本纪下',url:'https://www.shidianguji.com/book/HY2039/chapter/1kp8q1nrqihq7',extra:'https://zh.wikisource.org/wiki/北史/卷008'},
    women:{title:'《北齐书》卷九；《北史》卷十四 · 后妃',url:'https://www.shidianguji.com/book/HY2039/chapter/1kp8q24mohnb3',extra:'https://www.shidianguji.com/book/LS0011'},
    cheng:{title:'《北齐书》卷三；《北史》东魏孝静帝纪',url:'https://www.shidianguji.com/book/LS0011',extra:'https://www.shidianguji.com/book/SK0722'},
    yan:{title:'《北齐书》卷五、卷六；《北史》卷七',url:'https://www.shidianguji.com/book/LS0011',extra:'https://www.shidianguji.com/book/SK0722'}
  };
  // A document is a research lead, not an automatically verified source.
  // Fields: id, person, title, category, scene, relationship, account, primary,
  // secondary, boundary, source group, record status, linked existing event.
  const rows=[
    ['D01','高洋','粉黛、散发与市中游行','宫廷生活','mask','高洋 / 随从与市民','文档汇集了袒露、涂粉、散发、异服与出游的记载。页面用面具与街市符号表现，不把裸露当作杀人事件。','君主行为对礼仪规范的冲撞，是可研究的问题。','饮酒与自负是史书提供的背景；不能据此推断智力持续退化。','细节需逐段定位；“疯癫”是评价，不是现代诊断。','yang','文档线索'],
    ['D02','高洋','路晖礼案：军纪与极端惩罚','暴力事件','cauldron','高洋下令 → 路晖礼 / 同队士卒','文档称一名都督战伤、什长路晖礼未能救援，随后遭极端处置并被迫分食。属于战争背景中的惩罚，单列于原来的非战斗死亡样本之外。','军纪责任被君主转化为极端惩罚，待核具体命令。','史书以此标记行为转折；叙事转折不等于实际暴力第一次发生。','用命令线、器皿和消失的名牌表示，不复原分食动作；日期与人物字形待核。','yang','文档线索'],
    ['D03','高洋','旱灾之后：毁西门豹祠','政治与仪式','temple','高洋 → 西门豹祠 / 非人物杀害','文档记天保九年祈雨未应后毁祠、掘墓。研究对象是对神祠的惩罚，不算新增杀人事件。','灾害压力下，君权与祭祀责任的关系。','愤怒可能参与决定，但天气结果不能证明神祠有责任。','时间和原句待影印核对。','yang','文档线索'],
    ['D04','高洋','铁笼、刺击与火焚','暴力事件','cage','高洋 → 弟弟高浚、高涣','文档将拘禁铁笼、刺击和焚烧串成兄弟死亡的过程。动画分成围困、攻击符号、火焰三幕。','宗室猜忌与控制，是待追踪的政治线索。','持续拘禁和惩罚升级，比单个愤怒标签更值得核查。','死亡与焚尸的先后、具体施事者待对校；不默认两人同时被同一动作杀死。','yang','文档线索'],
    ['D05','高洋','元氏宗族遭到杀害','暴力事件','river','高洋 → 元氏旧皇族 / 家属亦被波及','文档记多家元氏被诛，并出现大规模人数与投漳水的描述。用多枚姓名牌与河流象征连带迫害。','新王朝对旧皇族的政治控制。','族属身份与集体惩罚的关系；并非某一族群天性。','“二十五家”“三千人”保留为待核线索，不能当作已核定统计。','yang','文档线索'],
    ['D06','高洋','薛嫔：杀害、展示与哀悼','暴力事件','instrument','高洋 → 薛嫔 / 猜忌涉及高岳','文档加入宴席展示和以骨制乐器的叙述。现有薛嫔案已经展示本纪与后妃传的时间差异，新增画面用遮幕、琵琶与断弦表示死后叙述。','关系猜忌与占有式惩罚，有文本线索。','宴席展示、哀悼与史臣塑造反差的写法。','不把杀害、分解、乐器和送葬拼成已证实的连续现场；死后处置与致死动作分开。','women','已有事件 · 扩充叙述','E04'],
    ['D07','高洋','殿上刑具与穆嵩案','暴力事件','saw','高洋 → 穆嵩 / 尉子耀为另一线索','文档提及锅、锯、锉、碓等刑具，并把穆嵩与尉子耀列为受害者。两人的实施方式需要分别查证。','展示刑具是否使恐惧成为日常统治的一部分？','饮酒、随意发令与官员无法制止的处境。','锯形运动为文档待核示意；不能由刑具清单推断每件都实际用于同一人。','yang','文档线索'],
    ['D08','高洋','殴母与事后谢罪','暴力事件','beat','高洋 → 母亲娄太后','文档记醉后伤害娄太后、醒后谢罪。伤害与悔意并存，不等于悔意消除了后果。','皇权是否使家庭内部也失去阻止暴力的能力？','饮酒可能是促发条件，具体因果仍待核。','伤害事件，非死亡；抬榻等细节待核，不据文档诊断。','yang','文档线索'],
    ['D09','高洋','宫廷性暴力与报复说辞','宫廷权力','seal','高洋 → 元氏皇后等女性 / 涉及高澄','文档引用高洋以兄长侵犯妻子为报复理由的记载。女性是受害者，不能以“荒淫故事”消解强迫与权力差。','君主利用权力实施侵犯。','报复说辞属于史书归于人物的解释，须与实际动机区分。','用封闭宫门与关系线呈现，不补造性行为画面。','women','文档线索'],
    ['D10','高湛','李祖娥与高绍德','暴力事件','beat','高湛 → 皇嫂李祖娥、侄子高绍德','记载把以儿子生命相胁的强迫、女婴死亡、绍德被杀与李祖娥遭伤害联系起来。李祖娥后来存活并入尼寺，不能误写成被杀。','掌权者对女性及其子女的强制控制。','亲属关系与报复语言共同参与暴力升级。','《宗室传》与《后妃传》叙述重心不同；刀环击打与挥刀斩杀不可混同。','women','录文已定位 · 影印待核'],
    ['D11','高湛','高百年：从“敕”字到死刑','暴力事件','beat','高湛下令 / 左右执行 → 侄子高百年','《宗室传》记书写“敕”字被上奏、召见后遭殴打并处斩；其妃斛律氏后来绝食而死，是相连但不同的死亡。','继承竞争与对前太子身份的猜忌。','灾异解释与告发使威胁感获得触发点。','动画表现告发文书、击打提示、名牌淡出；不把妻子之死画成同一次处刑。','kings','录文已对照 · 影印待核'],
    ['D12','高湛','四名侄辈：不是四次亲手行凶','人物比较','network','高湛 → 高绍德、高百年、高孝瑜、高孝琬','将文档列出的四案并排比较。已有高孝瑜、高孝琬档案可继续展开；每案区分下令、直接实施与押送。','皇权与宗室安全的冲突，各案须单独排序。','告发、宫廷竞争及称谓冲突的权重不同。','不能笼统写“四人都死于他的手”；孝瑜死亡方式有文字分歧。','kings','比较入口'],
    ['D13','高湛','母丧时的服饰与宴乐','政治与仪式','mask','高湛 / 娄太后、女儿、和士开','文档记录母丧期间服饰与宴乐冲突。它体现史书如何以礼制衡量帝王，不属于杀人方式。','君主是否受丧礼规范约束？','史臣的伦理评价与实际政治行为要分别阅读。','具体劝阻、责打等情节待核，不由违礼直接推导精神病。','wei','文档线索'],
    ['D14','高湛','和士开与“及时行乐”','宫廷权力','seal','和士开进言 → 高湛 / 高纬继位','文档将近臣劝说、禅位和太上皇时期联系起来。禅位不等于立即交出实权。','近臣与君主形成相互支持的权力关系。','享乐语言、接见朝臣减少与政治责任转移。','不凭早逝直接确定“酒色过度”这一医学死因；年龄口径须注明。','wei','文档线索'],
    ['D15','高纬','假城攻防：游戏进入真实伤害','暴力事件','arrow','高纬 / 内参扮演守军与攻城者','本纪记仿筑城池、让人扮演羌兵攻城，并有实际弯弓射人的描述。游戏身份没有让伤害变成虚构。','君主把真实的人纳入取乐场景。','侍从依附关系使退出或拒绝变得困难，是分析候选。','已读录文未支持文档“一次毒箭射死数百人”的强说法；毒箭与人数不作已核事实。','wei','录文已对照 · 文档夸张待核'],
    ['D16','高纬','穷儿之市与宫园扮演','宫廷生活','market','高纬 / 宫中陪同者','本纪记在园内仿贫困村舍、穿破衣扮乞儿并交易。它与现实财政、劳役的关系可以继续追问。','宫廷取乐与真实民生之间的距离。','史书以反差批评君主；不能把扮演直接诊断为某种“癖”。','不把乞儿扮演与假城射人混成一个事件。','wei','录文已定位 · 影印待核'],
    ['D17','高纬','犬马斗鸡获得官号','政治与仪式','animal','高纬 → 马、犬、斗鸡 / 官号失衡','本纪列动物获仪同、郡君等名号，斗鸡也获开府之号。用动物轮廓与官印飘落呈现名号秩序的反差。','恩宠分配与官号秩序的失衡。','养护花费与役使地方的经济负担。','“陵霄／凌霄”等字形须核；动物官号不是独立杀人案件。','wei','录文已定位 · 影印待核'],
    ['D18','高纬、高绰','蝎盆：伤害成为观赏','暴力事件','scorpion','高绰献说 / 高纬组织 → 姓名未详受害者','《宗室传》记高绰说到蝎与蛆，高纬随后搜集蝎并令人卧于浴斛，二人围观取乐。','以人的痛苦作为宫廷娱乐。','模仿、奖励与纵容可能促成伤害升级。','记载有受刑与惨叫，未在该段明确写受害者死亡；不能归作已证实致死案。','kings','录文已对照 · 伤害记载'],
    ['D19','高纬','征集少女与家长死刑威胁','宫廷权力','seal','高纬诏令 → 杂户未婚女子及家长','武平七年条文记征集特定年龄的杂户未婚女子，并以家长死刑惩罚隐匿。命令使家庭也承担威胁。','皇权对特定户籍群体的强制征集。','家长连带责任与服从机制。','诏令中的死刑威胁，不代表已查明实际处死人次；“杂户”需结合制度史解释。','wei','录文已定位 · 影印待核'],
    ['D20','高纬','名将遇害与军事后果','人物比较','network','高纬 → 斛律光、高长恭','连接现有斛律光与兰陵王两个档案。追踪君主猜忌、近臣推动与军中声望，再讨论失去将领的后果。','掌兵重臣、宗室身份与君权之间的张力。','宫廷竞争；军事后果属于另一条需要证据的链。','不能把两次死亡直接当成北齐灭亡的唯一原因，亦不笼统称所有家属均被杀。','wei','已有事件','E08'],
    ['D21','高纬','冯小怜与亡国叙述','宫廷权力','market','高纬 / 冯小怜 / 北周军队','文档将狩猎、军情与被俘后索还冯小怜连成亡国故事。应先追君主决策和军事过程，再分析后妃叙事。','君主对军情与指挥的处置应承担主要解释位置。','宠爱与娱乐可能影响行动，女性不能替君主承担全部亡国责任。','“玉体横陈”属于后世诗歌表达；典故不能作为当时现场记录。','women','文档线索'],
    ['D22','高纬','末日禅位：高恒与高湝','政治与仪式','seal','高纬 → 高恒 → 任城王高湝','本纪记高纬传位幼主高恒，其后又有让位高湝、使者携诏与玺归周的过程。文档中的“诏书未送到”需要放入这个过程。','军事失败后的责任与政权延续安排。','灾异解释与先例影响政治选择。','高恒“八岁”为史书年龄，不能直接视为现代周岁；不把两次让位省略为一场戏。','wei','录文已定位 · 影印待核'],
    ['D23','高绰','纵犬噬人','暴力事件','dog','高绰下令 → 姓名未详受害者 / 犬','《宗室传》将强迫人摆出兽状与纵犬攻击联系起来。用逼近犬影和人的退避表现行为，不细绘伤口。','把人降为取乐对象的权力关系。','地方属官与侍从无法阻止、君主事后赦免，是值得追踪的条件。','受害者姓名和各次人数未详；不制造名册或确定出血量。','kings','录文已对照 · 影印待核'],
    ['D24','高绰','妇人与孩子遭害','暴力事件','dog','高绰 → 妇人与孩子 / 姓名未详','文档所列母子遭害段落在《宗室传》录文中可定位。页面保留事件及受害关系，画面用母子名牌、草丛和犬影表示。','权力持有者对无力抵抗者的暴力。','后主先锁送、随后赦免，提示追责未能阻断暴力。','婴幼儿遭害不绘成身体受损动画；姓名、年龄和日期仍未详。','kings','录文已定位 · 影印待核'],
    ['D25','高绰','谏言之后：斩犬令对方噤声','暴力事件','animal','高绰 → 犬 / 尉破胡劝谏后退避','《宗室传》记高绰在晋阳因养犬受到劝谏，突然斩犬，劝谏者惊退。这次伤害的对象是犬。','暴力如何令劝谏停止。','少年宗室的地位与缺乏约束的处境。','与纵犬伤人分开；不把斩犬加入人类死亡数。','kings','录文已定位 · 影印待核'],
    ['D26','高绰','从受宠到被扼杀','暴力事件','wrestle','高纬下令 / 何猥萨执行 → 兄长高绰','《宗室传》记韩长鸾促成谋反指控，后主令何猥萨以相扑为掩饰扼杀高绰；本纪系于574年。','近臣竞争与宗室谋反指控，暂列主要候选。','隐蔽处置避免公开行刑；此前受宠未保障其安全。','扼杀有明确用字，但不复原操作技巧；数百日后尸体如生为史书记述，不能当作科学事实。','kings','录文已对照 · 影印待核'],
    ['D27','高绰','庶嫡与模仿：动机能推到哪里？','人物比较','network','高绰 / 同父兄弟高纬 / 伯父高洋','传记记二人同日出生与庶嫡排序，又记高绰自称学文宣伯。可讨论身份与模仿，但文档“失位导致扭曲”超出了直接证据。','模仿说与君主赦免、奖宠，比单纯猜测心理更可追踪。','庶嫡身份是背景条件，尚未证明是暴力的主要原因。','“与生俱来的不公成为一生扭曲开端”属于今人推断，不作为事实。','kings','文档推断已区分'],
    ['D28','高澄','郑大车案与家内处分','宫廷权力','network','高澄 / 父亲高欢 / 郑大车','文档称高澄与父妾私通，遭高欢杖责与幽禁。作为家内伦理和权力材料，仍需补篇章定位。','家长权威与性关系禁忌的冲突。','揭发与处分如何影响父子关系。','不认定为高氏所有性暴力的“起点”；缺少全家族连续证据。','cheng','文档线索'],
    ['D29','高澄','李祖娥与高洋的报复叙述','宫廷权力','seal','高澄 / 李祖娥 / 高洋','文档将高洋的报复说辞倒推为高澄侵害李祖娥的完整现场。应展示说辞的归属和来源局限。','掌权男性对女性的侵犯与强迫，是研究方向。','后来的报复说法未必准确说明早先全部经过。','没有补造具体动作；本条与高洋宫廷性暴力互相关联。','women','文档线索'],
    ['D30','高澄','权臣殴辱东魏皇帝','暴力事件','beat','高澄命令 / 崔季舒执行 → 孝静帝元善见','文档记饮酒时的言语冲突后，高澄命崔季舒击打孝静帝。应核具体用字与次数，区分命令者和执行者。','实际权力凌驾皇帝名位的君臣关系。','宴饮与情绪为可能触发条件。','此为伤害与羞辱，非皇帝当场死亡；细节仍待原典逐句核对。','cheng','文档线索'],
    ['D31','高澄','兰京刺杀：权臣成为受害者','暴力事件','assassin','兰京 → 高澄 / 549年，北齐建立之前','文档补入高澄遇刺，改变了始终把他当作施害者的单向视角。刺杀与高洋次年建国应按时间分开。','主仆冲突及刺杀机会需要回到传记查证。','后继权力安排是结果层，不等于刺客动机。','示意刀影与屏风，不补造谈话、武器型号或致伤部位。','cheng','文档线索'],
    ['D32','高演','高殷之死与报应叙事','暴力事件','seal','高演下令 → 侄子、废帝高殷','文档记高殷遭杀及高演后来惊惧、坠马。应将死亡命令、身体事故与史书报应解释分成三层。','夺位后对前帝与继承的安全顾虑，是待核候选。','梦兆、惊惧与史臣伦理叙事，不能直接证明鬼神因果。','文档写“毒杀”尚未核定，不动画化为赐毒；不把幻觉词语当作临床诊断。','yan','文档线索'],
    ['D34','高纬','剥面皮的记载：身份与方式仍待细核','暴力事件','mask','高纬 → 姓名未详受害者','本纪有杀人后剥面皮查看的叙述。画面用面具淡出表示，死亡与死后处置分开。','以人的身体满足支配与观看欲望，是待讨论的行为层。','史书把这类段落放在君主失德叙述中；尚不能追认每次行为的心理状态。','受害者、次数、日期未详，不绘成已知人物的确定死亡现场。','wei','录文已定位 · 影印待核'],
    ['D33','胡太后','后妃、近臣与僧侣叙述','宫廷权力','network','胡太后 / 和士开 / 昙献 / 高纬','文档提及握槊、私通和僧侣入宫。研究可追踪后宫与近臣关系如何进入政治叙述。','关系网络与权力分配，需要结合事件证据。','史臣对女性与私德的评价可能影响叙述选择。','握槊是一种游戏，不能把这个词本身释为性行为；不作“女性导致亡国”的归因。','women','文档线索']
  ];
  const items=rows.map(r=>({id:r[0],person:r[1],title:r[2],category:r[3],scene:r[4],relation:r[5],account:r[6],primary:r[7],secondary:r[8],boundary:r[9],ref:r[10],status:r[11],event:r[12]}));
  window.RESEARCH.dossier=items;
  let artworkSerial=0;
  const silhouette=(x,y,label,weapon='none')=>`<g class="d-person" transform="translate(${x} ${y})"><ellipse cy="5" rx="27" ry="4" fill="#071810" opacity=".3"/><g class="d-figure-move"><g transform="scale(.91)">${window.RESEARCH.sceneFigure(0,0,x<220?'actor':'victim',weapon)}</g></g></g><text class="d-person-name" x="${x}" y="${y+25}" text-anchor="middle">${esc(label)}</text>`;
  function art(e,detail=false){
    const uid='d-scene-'+artworkSerial++;
    const human=silhouette(270,192,e.scene==='cage'?'高浚 / 高涣':e.scene==='saw'?'穆嵩（待核）':e.scene==='wrestle'?'高绰':e.scene==='assassin'?'高澄':e.scene==='scorpion'?'受刑者未详':e.scene==='dog'?(e.id==='D24'?'母子 / 名牌示意':'受害者未详'):e.scene==='arrow'?'攻城扮演者':'关系对象');
    const dog='<g class="d-dog"><ellipse cx="144" cy="204" rx="36" ry="4" fill="#071810" opacity=".35"/><path d="M106 168Q100 150 103 145Q110 164 122 166L151 164L163 147L180 146L193 157L192 162L175 167L163 187Q143 192 121 187L113 178Z" fill="#849986" stroke="#b1b59a" stroke-width=".8"/><path d="M166 148L164 135L172 140L177 147M174 166L159 174M119 168Q132 171 149 170" fill="none" stroke="#d0c29a" stroke-opacity=".5"/><g class="d-dog-leg"><path d="M124 184L121 201L130 202M154 184L161 200L169 201" fill="none" stroke="#7d927f" stroke-width="4"/></g><path d="M137 186L140 201M160 179L175 195" stroke="#4f685a" stroke-width="3"/><circle cx="179" cy="152" r="1" fill="#d6c597"/><path d="M187 159H192" stroke="#172c22" stroke-width="3"/></g>' ;
    const motifs={
      cage:`${human}<g fill="none" stroke="#9c9b82" stroke-width="2"><path d="M216 78H322V202H216Z M216 202L223 211M322 202L315 211" stroke="#596c5e" stroke-width="4"/><rect x="221" y="80" width="97" height="119"/><path d="M221 112H318M221 181H318M259 80V199" stroke-opacity=".6"/><rect x="272" y="144" width="7" height="9" fill="#ad9667"/>${[235,252,270,288,306].map(x=>`<path d="M${x} 80V199"/>`).join('')}</g><path class="d-spear" d="M98 143H241L225 135M241 143L225 151" fill="none" stroke="#dec99c" stroke-width="4"/><g class="d-flame" fill="#c35c39"><ellipse cx="271" cy="196" rx="56" ry="18" fill="#e69145" opacity=".16"/>${[232,252,273,293].map(x=>`<path d="M${x} 202Q${x-18} 178 ${x+2} 158Q${x+3} 179 ${x+11} 186Q${x+16} 194 ${x} 202"/>`).join('')}</g>`,
      scorpion:`<ellipse cx="269" cy="208" rx="67" ry="8" fill="#091c13" opacity=".45"/><path d="M206 157H332L315 208H222Z" fill="#5d5840" stroke="#ba9e68" stroke-width="1.5"/><path d="M218 170L226 201M236 172L241 203M259 174V204M286 172L281 203M312 170L306 201" stroke="#b69e73" stroke-opacity=".3"/>${human}<g class="d-scorpions" stroke="#d1a06c" fill="none" stroke-width="2">${[224,239,255,274,291,310].map((x,i)=>`<g transform="translate(${x} ${180+i%2*12})"><ellipse rx="6" ry="3" fill="#a48c60" fill-opacity=".25"/><path d="M-6 0L-12-6M-6 2L-14 6M6 0L11-6M6 2L14 6M0-3Q-8-18 2-18L5-11M-2-4L-4-9M-4-10L-3-14M0-18L3-16"/></g>`).join('')}</g>`,
      dog:`${dog}${e.id==='D24'?'<g class="d-retreat"><rect x="235" y="116" width="75" height="78" fill="none" stroke="#b6ab88"/><text x="272" y="144" text-anchor="middle">妇人与孩子</text><text x="272" y="169" text-anchor="middle">姓名未详</text></g>':`<g class="d-retreat">${human}</g>`}`,
      arrow:`${silhouette(112,192,'高纬')}<path d="M163 110Q200 150 163 182L166 112V180" fill="none" stroke="#c8b382" stroke-width="3"/><g class="d-arrow"><path d="M173 146H264L253 140M264 146L253 152" stroke="#c8b382" stroke-width="3"/></g>${human}<path d="M312 82H373V199H312M312 99H373" stroke="#738874" fill="none"/>`,
      saw:`${human}<g class="d-saw" stroke="#d1b68a" fill="none" stroke-width="3"><path d="M195 151H347"/>${Array.from({length:15},(_,i)=>`<path d="M${200+i*9} 151l4 7 4-7"/>`).join('')}</g><text x="270" y="84" text-anchor="middle">刑具示意 / 实施细节待核</text>`,
      wrestle:`${silhouette(173,192,'何猥萨')}<g class="d-retreat">${human}</g><path class="d-contact" d="M202 124Q237 111 261 130" fill="none" stroke="#c26c4c" stroke-width="1.5" stroke-dasharray="2 4"/>`,
      assassin:`${silhouette(142,192,'兰京','thrust')}<path class="d-spear" d="M155 148H250L233 141M250 148L233 155" stroke="#d5c19b" stroke-width="4" fill="none"/>${human}<path d="M321 79V197M333 79V197M345 79V197" stroke="#596d5d" stroke-width="6"/>`,
      beat:`${human}<g class="d-impact" fill="none" stroke="#c77b57" stroke-width="3"><path d="M230 107L211 95M222 124H200M226 141L205 154"/></g><path class="d-command" d="M108 123H187" stroke="#b77351" stroke-width="2"/><text x="145" y="105" text-anchor="middle">${esc(e.person)}</text>`,
      river:`<path class="d-water" d="M63 184Q125 165 187 184T310 184T432 184M63 200Q125 181 187 200T310 200T432 200" stroke="#7e9380" fill="none" stroke-width="3"/><g class="d-fade" fill="none" stroke="#bbaa85">${[175,220,265,310].map(x=>`<rect x="${x}" y="107" width="25" height="56"/>`).join('')}</g><text x="254" y="87" text-anchor="middle">元氏家属 / 人数待核</text>`,
      cauldron:`<path d="M170 134H310L292 192H188Z" fill="none" stroke="#bca77c" stroke-width="4"/><path class="d-smoke" d="M207 120Q191 102 209 82M244 120Q231 96 249 77M278 120Q262 102 280 82" stroke="#9cac91" fill="none" stroke-width="3"/><text x="240" y="218" text-anchor="middle">路晖礼 / 暴力惩罚记载</text>`,
      instrument:'<path d="M248 87L258 115Q301 151 269 189Q228 220 204 180Q185 142 237 114L240 84Z" fill="none" stroke="#ccb28a" stroke-width="3"/><g class="d-string" stroke="#bca37f"><path d="M242 94L234 178M247 94L242 178M252 94L250 178"/></g><path class="d-impact" d="M240 144l13 12-15 12" fill="none" stroke="#b95d42" stroke-width="3"/><text x="240" y="222" text-anchor="middle">薛嫔 / 死后叙述</text>',
      temple:'<g class="d-retreat" fill="none" stroke="#bba980" stroke-width="3"><path d="M167 116L240 83L313 116H167M182 122V191H299V122M216 191V145H264V191"/></g><path class="d-impact" d="M241 99l-18 34 26 17-18 35" stroke="#c07751" fill="none" stroke-width="3"/><text x="240" y="222" text-anchor="middle">西门豹祠 / 非人物杀害</text>',
      animal:`${dog}<g class="d-stamp" fill="none" stroke="#c29163" stroke-width="2"><rect x="229" y="98" width="60" height="75"/><text x="259" y="127" text-anchor="middle">${e.id==='D25'?'谏':'官'}</text><text x="259" y="153" text-anchor="middle">${e.id==='D25'?'止':'号'}</text></g>`,
      market:'<g fill="none" stroke="#a99e7a" stroke-width="3"><path d="M101 117L146 91L191 117M112 117V190H180V117M281 117L326 91L371 117M292 117V190H360V117"/></g><g class="d-stamp"><circle cx="240" cy="140" r="23" fill="none" stroke="#b18b5f"/><text x="240" y="146" text-anchor="middle">戏</text></g>',
      mask:'<g class="d-mask" fill="none" stroke="#c2ac83" stroke-width="3"><path d="M197 91Q240 66 283 91V157Q240 210 197 157Z"/><path d="M210 115L225 121M270 115L255 121M223 155Q240 172 257 155"/></g><circle class="d-stamp" cx="320" cy="92" r="24" fill="#a65f46" opacity=".4"/>',
      network:'<g stroke="#a99f7d" fill="none" stroke-width="2"><path class="d-command" d="M240 96L145 171L332 171Z"/><circle cx="240" cy="96" r="24"/><circle cx="145" cy="171" r="24"/><circle cx="332" cy="171" r="24"/></g><text x="240" y="101" text-anchor="middle">权</text><text x="145" y="176" text-anchor="middle">亲</text><text x="332" y="176" text-anchor="middle">臣</text>',
      seal:'<path d="M199 104H281V193H199Z" fill="none" stroke="#b09a74" stroke-width="2"/><g class="d-stamp" stroke="#c37951" fill="none" stroke-width="3"><rect x="216" y="122" width="48" height="48"/><text x="240" y="153" text-anchor="middle">令</text></g>'
    };
    const phases={cage:['拘禁','刺击示意','火焚记载'],scorpion:['命令','受刑','伤害记载'],dog:['逼近','退避','受害记载'],arrow:['张弓','放箭','真实伤害'],saw:['刑具','锯形示意','记载待核'],wrestle:['相扑掩饰','接近','死亡记载'],assassin:['接近','刺杀示意','死亡记载'],beat:['命令','伤害','后果'],instrument:['杀害记载','死后处置','叙述对照']}[e.scene]||['关系','行为','回看记录'];
    return `<svg class="d-art d-${e.scene}${detail?' d-detail':''}" viewBox="0 0 480 340" role="img" aria-label="${esc(e.title+'；'+e.relation+'；象征动画')}" style="--d-delay:0s">${window.RESEARCH.sceneBackdrop(uid,246)}<g class="v-relation"><rect x="44" y="19" width="392" height="40" rx="2" fill="#13271f" fill-opacity=".75"/><text x="57" y="35" class="d-relation">${esc(e.relation)}</text><text x="57" y="50" class="d-caption">${esc(e.category)} / ${esc(e.status)}</text></g><g class="d-action-stage" transform="translate(0 52)">${motifs[e.scene]||motifs.seal}</g><path d="M27 286H452" stroke="#998966" stroke-opacity=".2"/><path class="d-clock-line" d="M27 286H452" stroke="#bd9b63" stroke-width="1.2"/><g class="d-phases">${phases.map((step,i)=>`<g class="d-phase d-phase-${i}"><circle cx="${47+i*139}" cy="303" r="2"/><text x="${58+i*139}" y="307">${i+1}. ${esc(step)}</text></g>`).join('')}</g><text x="26" y="329" class="d-caption">动作、服饰与场景均为美术示意</text><text x="453" y="329" text-anchor="end" class="d-caption">${e.id}</text></svg>`;

  }
  const data=window.RESEARCH;
  Object.entries(refs).forEach(([key,r],i)=>{
    data.sources['archive-'+key]={number:12+i,title:r.title,book:r.title,edition:'识典古籍原典入口；辅助录文／目录用于定位。',quote:'',explanation:'请由原典入口核查本条；没有逐句定位的材料保留为线索，不生成伪引文。',status:'卷十二与卷八相关录文已定位或对照；其他材料仍待定位。影印逐字核对与版本关系研究未完成。',links:[['识典 · 原典入口',r.url],['辅助对照／目录',r.extra]]};
  });
  const mergeIds=new Set(['D06','D12','D20']);
  const dates={D31:549,D26:574,D19:576};
  data.dossierArtwork=art;
  data.dossierForEvent={E04:items.find(e=>e.id==='D06')};
  items.filter(e=>!mergeIds.has(e.id)).forEach(e=>data.events.push({id:e.id,ruler:e.person,name:e.title,aliases:e.relation,year:dates[e.id]?dates[e.id]+'年':'具体年份待核',type:e.category,category:e.category,source:'archive-'+e.ref,context:e.account,agency:e.relation,primary:e.primary,secondary:e.secondary,boundary:e.boundary,status:e.status,dossier:e,date:dates[e.id],method:e.category==='暴力事件'?({cage:'拘禁、刺击与火焚',scorpion:'蝎盆伤害',dog:'纵犬伤害',saw:'刑具记载待核',arrow:'射箭伤害',wrestle:'相扑掩饰下扼杀',assassin:'刺杀',beat:'击打与伤害',river:'宗族集体迫害',mask:'死后处置'}[e.scene]||'方式待核'):e.category}));
  const related={E04:['D09','D29'],E05:['D10','D11'],E06:['D10','D11'],E08:['E09','D26'],E09:['E08','D26'],E07:['D11','D26','D27']};
  data.relatedEvents=related;
  const galleryIds=['D04','D18','D15','D23','D26','D31','D07','D11','D10'];
  const gallery=document.querySelector('#violence-cards');
  const extraCards=galleryIds.map(id=>items.find(e=>e.id===id)).map(e=>`<button class="violence-card d-card" data-event="${e.event||e.id}"><span class="v-card-top"><span>${esc(e.person)} / ${esc(e.category)}</span><span class="v-status">${esc(e.status)}</span></span>${art(e)}<span class="v-card-body"><span class="v-subtitle">${esc(e.relation)}</span><strong>${esc(e.title)}</strong><span class="v-question">${esc(e.primary)}</span><span class="v-card-link">展开事件与深层原因 <span aria-hidden="true">↗</span></span></span></button>`).join('');
  gallery.insertAdjacentHTML('beforeend',extraCards);
  const cards=[...gallery.children];
  const order=[0,1,7,8,2,11,3,14,4,9,6,10,12,13,15,5];
  order.forEach(i=>gallery.append(cards[i]));
  [...gallery.children].forEach((card,i)=>{const label=card.querySelector('.v-card-top > span');label.textContent=String(i+1).padStart(2,'0')+' / '+label.textContent.replace(/^\d+ \/ /,'');});
  const observer=new IntersectionObserver(entries=>entries.forEach(x=>x.target.classList.toggle('d-visible',x.isIntersecting)),{rootMargin:'50px'});
  gallery.querySelectorAll('.d-card').forEach(c=>observer.observe(c));
  document.addEventListener('archive-replay',()=>{document.documentElement.classList.add('d-restarting');requestAnimationFrame(()=>requestAnimationFrame(()=>document.documentElement.classList.remove('d-restarting')));});
  const dialog=document.querySelector('#detail-dialog');new MutationObserver(()=>document.documentElement.classList.toggle('scene-dialog-open',dialog.open)).observe(dialog,{attributes:true,attributeFilter:['open']});
  document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('scene-background',document.hidden));
  const motion=document.querySelector('#violence-motion');
  const sync=()=>document.documentElement.classList.toggle('d-motion-paused',motion.getAttribute('aria-pressed')==='true');
  new MutationObserver(sync).observe(motion,{attributes:true,attributeFilter:['aria-pressed']});sync();
  document.querySelector('#sources').insertAdjacentHTML('beforeend',`<details class="d-critique"><summary>阅读边界：评价、心理与数字怎样判断？</summary><div><p><strong>“禽兽王朝”与残暴评分：</strong>可研究其传播与评价方式，但材料未提供可追溯的早期命名出处或评分尺度；不作为历史排名。</p><p><strong>“全员未活过40岁”：</strong>不能覆盖高欢及宗室整体。帝王、宗室范围和史书年龄口径需分开，不能拿选中的短寿者代表全家族。</p><p><strong>“遗传性精神疾病”“智商退化”：</strong>材料没有临床和遗传证据。童年断乱丝的故事也不能换算成智商测量。史书中的暴虐、饮酒或奇异行为不足以作现代疾病诊断。</p><p><strong>高绰失位导致扭曲：</strong>庶嫡排序有记载，心理因果属于今人推断；模仿、奖宠和追责是否失效更需要逐案追踪。</p><p><strong>毒箭射死数百人：</strong>已读本纪只支持实际射人的描述，材料的毒箭、人数尚待证据。高殷“毒杀”也不在核定前绘成饮药。</p><p><strong>人数、年龄与女性叙事：</strong>家属受害、实际死刑与死刑威胁分开；八岁等史书年龄不直接换成周岁。李祖娥的存活和受害经历保留，不以冯小怜或胡太后的私德替代军事与政治解释。</p><p><strong>来源性质：</strong>识典是原典入口；新闻、专栏和成语故事是线索或后世解释。材料未给这些文章完整书目信息，本页不将它们算作独立史料。</p></div></details>`);
})();
