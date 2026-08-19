import re,random,pickle,os,time,threading,queue,socketio
CONSECUTIVE_DOUBLES_FOR_TELEPORT=3
class ChatConnection:
    def __init__(self,bot):
        self._bot=bot
    def privmsg(self,target,text):
        self._bot.send_chat(target,text)
class MonopolyBot:
    def __init__(self, ch='##rento', nick='player1bot', users=None, num_players=6, ws_url=None):
        self.channel = ch.lower()
        self.board_regular = {0:"Start",1:"x-Libya",2:"Chest",3:"x-Sudan",4:"x-WaterPlant",5:"x-StationJapan",6:"x-Turkey",7:"Clover",8:"x-Greece",9:"x-Bulgaria",10:"Jail",11:"x-Poland",12:"x-Russia",13:"x-HealthCare",14:"x-Ukraine",15:"x-StationSpain",16:"x-Lithuania",17:"x-Latvia",18:"Chest",19:"x-Estonia",20:"Parking",21:"x-Norway",22:"x-Sweden",23:"Clover",24:"x-Finland",25:"x-StationKorea",26:"x-Germany",27:"x-Wifi",28:"x-France",29:"x-UK",30:"GotoJail",31:"x-Canada",32:"Clover",33:"x-Mexico",34:"x-USA",35:"x-StationIndia",36:"Chest",37:"x-Qatar",38:"x-SolarPlant",39:"x-China"}
        self.board_deep = {40:"x-Hospital",41:"x-Serbia",42:"x-Croatia",43:"Japan",44:"x-Austria",45:"x-Italy",46:"x-Internet",47:"x-Belgium",48:"Chest",49:"Spain",50:"x-Chile",51:"x-Argentina",52:"x-Power",53:"x-Brazil",54:"Switch",55:"Korea",56:"x-Indonesia",57:"x-Malaysia",58:"x-Water",59:"x-Singapore",60:"Clover",61:"India",62:"Auction",63:"x-Romania"}
        self.non_property_regular = {0,2,7,10,18,20,23,30,32,36}
        self.non_property_deep = {48,54,60,62,43,49,55,61}
        self.house_costs = {"red":200,"orange":180,"yellow":150,"green":100,"blue":100,"pink":150,"brown":60,"dblue":60,"white":60,"purple":80,"aqua":100,"black":140}
        self.house_rents = {1:[5,20,30,90,160,250],3:[10,30,60,180,320,450],6:[10,40,90,270,400,550],8:[10,40,90,270,400,550],9:[15,50,100,300,450,600],11:[15,50,150,450,625,750],12:[15,50,150,450,625,750],14:[20,60,180,500,700,900],16:[20,70,200,550,750,950],17:[20,70,200,550,750,950],19:[30,80,220,600,800,1000],21:[30,90,250,700,875,1050],22:[30,90,250,700,875,1050],24:[40,100,300,750,925,1100],26:[40,110,330,800,975,1150],28:[40,110,330,800,975,1150],29:[50,120,360,850,1025,1200],31:[50,130,390,900,1100,1275],33:[50,150,450,1000,1200,1400],34:[60,150,450,1000,1200,1400],37:[60,175,500,1100,1300,1500],39:[80,200,600,1400,1700,2000],41:[15,50,100,300,450,600],42:[15,50,100,300,450,600],44:[30,80,220,600,800,1000],45:[30,80,220,600,800,1000],47:[30,90,250,700,875,1050],50:[25,70,180,450,650,800],51:[25,70,180,450,650,800],53:[25,75,200,500,700,850],56:[50,120,360,850,1025,1200],57:[50,120,360,850,1025,1200],59:[50,130,390,900,1100,1275],63:[15,50,150,450,625,750]}
        self.mortgage_table = {1:30,3:40,4:100,5:100,6:50,8:50,9:60,11:75,12:75,13:100,14:90,15:100,16:100,17:100,19:110,21:110,22:110,24:120,25:100,26:140,27:100,28:140,29:150,31:150,33:150,34:160,35:100,37:180,38:100,39:200,40:100,41:60,42:60,44:110,45:110,46:100,47:120,50:90,51:90,52:100,53:100,56:150,57:150,58:100,59:160,63:70}
        self.color_sets={"dblue":[1,3],"brown":[6,8,9],"blue":[11,12,14],"green":[16,17,19],"yellow":[21,22,24],"pink":[26,28,29],"orange":[31,33,34],"red":[37,39],"white":[41,42,63],"aqua":[44,45,47],"purple":[50,51,53],"black":[56,57,59]}
        self.unmortgaged_colors = {"p1":"red","p2":"blue","p3":"orange","p4":"green","p5":"purple","p6":"white"}
        self.mortgaged_colors = {"p1":"#FD829A","p2":"lightblue","p3":"#FFFD01","p4":"lightgreen","p5":"#D669FA","p6":"black"}
        self.mortgaged2_colors = {"m1":"#FD829A","m2":"lightblue","m3":"#FFFD01","m4":"lightgreen","m5":"#D669FA","m6":"black"}
        self.default_board = self.board_regular.copy()
        self.reset_state()
        self.go_enabled = False
        self.go_active = None
        self.go_numbers = {}
        self.go_timer = None
        self.go_lock = threading.Lock()
        self.turn = 'p1'
        self.override_next_turn = False
        self.go_input_users = users or ['p1','p2']
        self.num_players = num_players
        self.dice_mode = False
        self.dice_players = None
        self.dice_order = []
        self.expected_player_index = 0
        self.dice_override = False
        self.dice_lock = threading.Lock()
        self.state_lock = threading.Lock()
        self.msg_queue = queue.Queue()
        self.msg_worker = threading.Thread(target=self._process_msg_queue, daemon=True)    
        self.msg_worker.start()
        self.disabled_dice = set()
        self.space62_mortgage_block=False
        self.space62_mortgage_unlock_on_roll=False
        self.connection = ChatConnection(self)
        self.ws_url = ws_url or os.environ.get("RENTO_WS_URL", "https://monopoly-production-ef33.up.railway.app")
        self.sio = socketio.Client(reconnection=True, reconnection_delay=2, reconnection_delay_max=10)
        self._setup_ws_handlers()
        self.ws_thread = threading.Thread(target=self._run_ws_client, daemon=True)
        self.ws_thread.start()
    def any_player_negative(self):
        return any(p["money"]<0 for p in self.players.values())
    def send_chat(self,target,text):
        if not text:return
        try:
            if str(target).lower()==self.channel:
                self.sio.emit('chat-message',{'msg':text})
            else:
                if text.startswith(('!','/')):
                    text='\u200b'+text
                self.sio.emit('chat-message',{'msg':f'@{target} {text}'})
        except Exception as e:
            print(f'[WS] send_chat error: {e}')
    def _setup_ws_handlers(self):
        @self.sio.event
        def connect():
            print(f"[WS] Connected to {self.ws_url}")
        @self.sio.event
        def disconnect():
            print("[WS] Disconnected")
        @self.sio.on('rentoCommand')
        def on_rento_command(data):
            self._handle_ws_command(data)
    def _run_ws_client(self):
        while True:
            try:
                self.sio.connect(self.ws_url,wait_timeout=10)
                self.sio.wait()
            except Exception as e:
                print(f"[WS] Connection error: {e}")
            time.sleep(5)
    def _handle_ws_command(self,data):
        if not isinstance(data,dict):return
        nick=str(data.get('from','')).strip().lower()
        msg=str(data.get('msg','')).strip().lower()
        via=str(data.get('via','public')).strip().lower()
        if not nick or not msg:return
        try:
            if via=='private':
                self.handle_private_message(self.connection,nick,msg)
            else:
                self.handle_channel_message(self.connection,nick,msg)
        except Exception as e:
            print(f"[WS] Command error: {e}")
    def handle_private_message(self,c,nick,msg):
        low=msg.lower()
        if low.startswith(("!add","!freeloan","!gobonus")) and not low.startswith(("!addonehouse","!removeonehouse")):
            cmd=low.split()[0];return c.privmsg(nick,f"{cmd} can only be used in the main chat")
        if re.match(r"!dice[0-4]-p\d+",msg.strip().lower()):self._handle_dice_pub(c,nick,msg);return
        if re.match(r"!go[1-4](?:\s+\d+)?",msg.strip()):self.handle_go_command(c,msg.strip(),nick);return
        success,r=self.handle_command(nick,msg)
        if r:
            if low.startswith(("!bidadd","!fold","!addonehouse","!removeonehouse","!jailpay")):c.privmsg(self.channel,r)
            else:c.privmsg(nick,r)
        if success and low.startswith(("!addonehouse","!removeonehouse")):self.auto_up()
        self.handle_go_privmsg(c,nick,msg)
    def handle_channel_message(self,c,nick,msg):
        success,r=self.handle_command(nick,msg)
        if r:
            if success and msg.lower().startswith(("!start","!move","!add","!teleport","!addonehouse","!removeonehouse","!remove","!freeloan","!gobonus","!jailpay","!switch","!insert","!accept","!restore")):self.auto_up()
            c.privmsg(self.channel,r)
        self.handle_go_session_command(c,nick,msg)
        self.override_turn(c,nick,msg)
        self.handle_go_command(c,msg,nick)
        self.handle_go_privmsg(c,nick,msg)
        self._handle_dice_pub(c,nick,msg)
    def reset_state(self):
        self.players={}
        self.properties={}
        self.houses={}
        self.mortgaged=set()
        self.aliases={"p1":set(),"p2":set(),"p3":set(),"p4":set(),"p5":set(),"p6":set()}
        self.current_auction=None
        self.current_trade=None
        self.active_board=getattr(self,'default_board',{}).copy()
        self.non_property=set(getattr(self,'non_property_regular',set()))
        self.max_pos=39
        self.jailed = {}
        self.consecutive_doubles={}
        self.dice4_streak={}
        self.switch_required=False
        self.auction_required=False
        self.dice_rolls = {}
        self.passgo_bonus = {}
        self.free_loans={}
        self.go_jail_attempts={'p1':0,'p2':0}
        self.custom_names={}
        self.space62_mortgage_block=False
        self.space62_mortgage_unlock_on_roll=False
        self.auction_timeout=12
    def pname(self,msg):
        if not msg:return msg
        for p,name in self.custom_names.items():msg=re.sub(rf"\b{p}\b",name,msg)
        return msg
    def resolve_player(self,token):
        token=token.lower()
        if token in self.players:return token
        for p,name in self.custom_names.items():
            if token==name.lower():return p
        return None
    def _process_msg_queue(self):
        while True:
            try: t,m=self.msg_queue.get(); self.connection.privmsg(t,m); time.sleep(0.4)
            except Exception as e: print(f"[WS] send_chat queue error: {e}")
            finally: self.msg_queue.task_done()
    def auto_up(self):
        if not self.players:return
        pos=[];money=[];props=[];houses=[]
        for i in range(1,7):
            p=f"p{i}"
            if p in self.players:
                pos+=[str(self.players[p]["pos"])]
                money+=[str(self.players[p]["money"])]
                props+=[str(sum(o==p for o in self.properties.values()))]
                houses+=[str(sum(self.houses.get(x,0) for x,o in self.properties.items() if o==p))]
            else:
                pos+=["0"];money+=["0"];props+=["0"];houses+=["0"]
        try:
            self.sio.emit("cmd-mv-all",pos)
            self.sio.emit("cmd-set-all",money)
        except Exception as e:
            print(f"[WS] auto_up error: {e}")

    def handle_command(self,who,body):
        body=body.strip();caller=who.lower()

        if m:=re.match(r"!up$",body):
            if not self.players:return False,"No game in progress."
            self.auto_up();return True,None

        if m:=re.match(r"!alias\s+(p[1-6])\s+(\w+)",body):
            pl,a=m.groups();pl=pl.lower();a=a.lower()
            if not isinstance(self.aliases,dict):self.aliases={"p1":set(),"p2":set(),"p3":set(),"p4":set(),"p5":set(),"p6":set()}
            if pl not in self.aliases or pl not in self.players:return False,f"{pl} does not exist or game not started."
            if any(a in s for s in self.aliases.values()):return False,"Alias already used"
            self.aliases[pl].add(a)
            return True,self.pname(f"Alias '{a}' added for {pl}")

        if m:=re.match(r"!start\s+(\d+)\s*(deep|regular)?\s*(\d+)?\s*(\d+)?",body):
            n,mode,money,timeout=int(m.group(1)),m.group(2)or"regular",int(m.group(3)or 1000),int(m.group(4)or 12)
            if not 2<=n<=6:return False,"Number of players must be 2-6"
            if not 1<=timeout<=30:return False,"Autofold timer must be between 1 and 30 seconds"
            self.reset_state();self.num_players=n
            self.auction_timeout=timeout
            self.players={f"p{i+1}":{"money":money,"pos":0}for i in range(n)}
            self.active_board=self.board_regular.copy()if mode=="regular" else{**self.board_regular,**self.board_deep}
            self.non_property=set(self.non_property_regular)if mode=="regular" else set(self.non_property_regular)|set(self.non_property_deep)
            self.max_pos=39 if mode=="regular" else 63
            for i in range(n):self.aliases.setdefault(f"p{i+1}",set()).add(f"player{i+1}bot")
            try:
                    self.sio.emit("cmd-cleardot")
                    self.sio.emit("cmd-clear-buildings")
                    self.sio.emit("cmd-dotlocation",1 if mode=="regular" else 2)
                    self.sio.emit("cmd-map",1 if mode=="regular" else 2)
                    self._handle_dicestart(self.connection,n)
            except Exception as e:
                    return False,f"Game started but failed to initialize board: {e}"
            self.sio.emit("updateDisplay1",{"text":"Game has started"})
            self.sio.emit("updateDisplay2",{"text":"P1's Turn to Roll"})
            return True,f"Game started with {n} players ({mode}) ${money} each, auction auto-fold in {timeout}s"
      
        if m:=re.match(r"!rename\s+(\S+)\s+(\S+)",body):
            old,new=m.groups()
            target=old.lower()
            if target not in self.players:
                for p,n in self.custom_names.items():
                    if n.lower()==old.lower():target=p;break
                else:return False,"Player name not found"
            if not re.match(r"^[a-zA-Z]{1,2}[1-6]$|^p[1-6]$",new):return False,"Invalid format. Use p1-p6 or 1-2 letters + 1 number"
            if new.lower().startswith("p") and new.lower() in self.players:
                self.custom_names.pop(target,None)
                return True,f"{target} renamed back to {new.lower()}"
            if any(n.lower()==new.lower() and p!=target for p,n in self.custom_names.items()):
                return False,f"Name {new} is already taken"
            new=new[:-1].upper()+new[-1]
            self.custom_names[target]=new
            return True,f"{target} is now known as {new}"
       
        if m:=re.match(r"!move\s+([a-zA-Z0-9]+)\s+(-?\d+)",body):
            pl_token,sp=m.groups();sp=int(sp)
            pl_key=self.resolve_player(pl_token)
            if not pl_key or pl_key not in self.players:return False,f"Player {pl_token} does not exist"
            name,msg=self.move_player(pl_key,sp)
            return True,self.pname(f"{pl_key} moved to {self.players[pl_key]['pos']} ({name}). Money: {self.players[pl_key]['money']} |{msg}")

        if m:=re.match(r"!teleport\s+([a-zA-Z0-9]+)\s+(-?\d+)",body):
            pl_token,pos=m.groups();pos=int(pos)
            pl_key=self.resolve_player(pl_token)
            if not pl_key or pl_key not in self.players:return False,f"Player {pl_token} does not exist"
            if pos<0 or pos>self.max_pos:return False,f"Invalid position {pos}. Board range is 0-{self.max_pos}"
            self.players[pl_key]["pos"]=pos
            return True,self.pname(f"{pl_key} teleported to {pos}")

        if m:=re.match(r"!add\s+([a-zA-Z0-9]+)\s+(-?\d+)",body):
            pl_token,amount=m.groups();amount=int(amount)
            pl_key=self.resolve_player(pl_token)
            if not pl_key or pl_key not in self.players:return False,f"Player {pl_token} does not exist"
            if abs(amount)>500:return False,"Amount too large"
            self.players[pl_key]["money"]+=amount
            return True,self.pname(f"{pl_key} balance: {self.players[pl_key]['money']}")

        if m:=re.match(r"!switch\s+(\w+)\s+(\w+)$",body):
            p1,p2=m.groups();k1=self.resolve_player(p1);k2=self.resolve_player(p2)
            if not k1 or not k2:return False,"Player does not exist"
            if k1 not in self.players or k2 not in self.players:return False,"One or both players are not in the game"
            if k1==k2:return False,"Cannot switch a player with themselves"
            if bool(self.jailed.get(k1)) or bool(self.jailed.get(k2)):return True,"Cannot switch with a player in jail"
            self.players[k1]["pos"],self.players[k2]["pos"]=self.players[k2]["pos"],self.players[k1]["pos"]
            if self.switch_required:self.switch_required=False
            return True,self.pname(f"{k1} and {k2} switched")
         
        if m:=re.match(r"!remove\s+(\w+)$",body):
            rm_token=m.group(1);rm=self.resolve_player(rm_token)
            if not rm or rm not in self.players:return False,f"Player {rm_token} is not in the game"
            if rm[1:].isdigit():self._handle_diceremove(self.connection,int(rm[1:]))
            del self.players[rm]
            if rm in self.aliases:self.aliases[rm].clear()
            self.custom_names.pop(rm,None)
            if self.turn==rm:self.turn=next(iter(self.players),None)
            for pos in [p for p,o in self.properties.items() if o==rm]:
                del self.properties[pos];self.houses.pop(pos,None);self.mortgaged.discard(pos)
                self.active_board[pos]=f"x-{self.active_board.get(pos,f'Position {pos}').split('-',1)[-1]}"
            try:self.handle_command(caller,"!propertylist");self.handle_command(caller,"!housestatus")
            except Exception:pass
            try:self.sio.emit("cmd-sound",{"file":"laughter.mp3"})
            except Exception:pass
            return True,self.pname(f"{rm} has been removed")

        if m:=re.match(r"!insert\s+(p[1-6])\s+(-?\d+)$",body):
            pl,amt=m.groups();amt=int(amt);pl=pl.lower()
            if pl in self.players:return False,f"{pl} already exists"
            if amt<0:return False,"Starting money cannot be negative"
            self.players[pl]={"money":amt,"pos":0}
            self.aliases.setdefault(pl,set()).add(f"player{pl[1:]}bot")
            self.num_players=len(self.players)
            self.jailed[pl]=False
            try:self._handle_diceadd(self.connection,int(pl[1:]))
            except Exception:pass
            return True,f"{pl} inserted with ${amt}"

        if m:=re.match(r"!propertylist$",body.lower()):
            try:
                self.sio.emit("cmd-cleardot")
                non_props=self.non_property;groups={}
                for pos in sorted(self.active_board):
                    if pos in non_props:continue
                    owner=self.properties.get(pos)
                    if not owner:continue
                    if pos in self.mortgaged and owner.startswith("p"):owner=f"m{owner[1:]}"
                    color=self.unmortgaged_colors.get(owner) if owner and owner[0]=="p" else self.mortgaged2_colors.get(owner)
                    if not color:continue
                    groups.setdefault((owner,color),[]).append(pos)
                for (owner,color),positions in groups.items():
                    self.sio.emit("cmd-dot",{"num":positions,"color":color})
                return True,""
            except Exception as e:
                return False,f"Could not process property list: {e}"

        if m:=re.match(r"!housestatus$",body.lower()):
            try:self.sio.emit("cmd-clear-buildings")
            except Exception:pass
            groups={1:[],2:[],3:[],4:[],"hotel":[]}
            for color,positions in self.color_sets.items():
                for p in positions:
                    if p not in self.active_board:continue
                    h=self.houses.get(p,0)
                    if h==5:groups["hotel"].append(p)
                    elif 1<=h<=4:groups[h].append(p)
            try:
                for n in (1,2,3,4):
                    if groups[n]:
                        self.sio.emit("cmd-house",{"type":f"house{n}","spaces":groups[n]})
                if groups["hotel"]:
                    self.sio.emit("cmd-house",{"type":"hotel","spaces":groups["hotel"]})
            except Exception:pass
            return True,None

        if m:=re.match(r"!status(?:\s+(\w+))?$",body.lower()):
            if not self.players:return False,"No game in progress."
            target=m.group(1)
            if target:
                target=self.resolve_player(target)
                if not target:return False,"Player not found"
                players=[target]
            else:
                players=list(self.players.keys())
            lines=[]
            for p in players:
                if p not in self.players:continue
                d=self.players[p];owned=sorted([x for x,o in self.properties.items() if o==p]);prop_list=[]
                for x in owned:
                    pn=self.active_board.get(x,f"Position {x}")
                    if "-" in pn:pn=pn.split("-",1)[1]
                    if x in self.mortgaged:pn=f"{pn}(M)"
                    if self.houses.get(x,0):pn+=f"[{self.houses.get(x,0)}]"
                    prop_list.append(f"{x}-{pn}")
                props="|".join(prop_list)or"None"
                pg=self.passgo_bonus.get(p)
                go=f"|GO:{pg.get('cap',0)-pg.get('used',0)}/{pg.get('cap',0)}" if pg else ""
                loan=self.free_loans.get(p)
                loan_txt=f"|Loan:{loan.get('owed',0)}" if loan and loan.get("owed",0)>0 else ""
                lines.append(self.pname(f"{p}|{props}{go}{loan_txt}"))
            for line in lines:
                self.connection.privmsg(self.channel,line)
            return True,""
        
        if m:=re.match(r"!jailpay\s+(\w+)",body):
            pl_token=m.group(1);pl=self.resolve_player(pl_token)
            if not pl or pl not in self.players:return False,f"Player {pl_token} is not in the game"
            if not self.jailed.get(pl,False):return False,f"{self.pname(pl)} is not in jail"
            if self.go_enabled:
                if self.turn!=pl:
                    other='p2' if pl=='p1' else 'p1'
                    return False,f"Not {self.pname(pl)}'s turn. Next: {self.pname(other)}"
            elif self.dice_mode and self.dice_order:
                if self.expected_player_index>=len(self.dice_order):return False,"Invalid dice turn order"
                pn=int(pl[1:]);exp=self.dice_order[self.expected_player_index]
                if pn!=exp:return False,f"Not {self.pname(pl)}'s turn. Next: {self.pname(f'p{exp}')}"
            turn=max(self.go_jail_attempts.get(pl,0),self.dice4_streak.get(pl,0))
            cost=[100,50,25][min(turn,2)]
            if self.players[pl]["money"]<cost:return False,f"{self.pname(pl)} does not have enough money to pay bail ({cost})"
            self.players[pl]["money"]-=cost;self.jailed[pl]=False
            self.go_jail_attempts[pl]=0;self.dice4_streak[pl]=0
            try:self.sio.emit("cmd-sound",{"file":"key.mp3"})
            except Exception:pass
            return True,self.pname(f"{pl} paid ${cost} bail (turn {turn+1}) and is now out of jail. Balance: {self.players[pl]['money']}")
            
        if m:=re.match(r"!gobonus\s+(\w+)\s+(\d+)\s+(\d+)$",body):
            pl_token,bonus,cap=m.groups();bonus=int(bonus);cap=int(cap)
            pl=self.resolve_player(pl_token)
            if not pl or pl not in self.players:return False,f"{pl_token} not in game"
            if bonus not in (100,50,25,10):return False,"GO bonus amount must be 100,50,25,or 10"
            if cap not in (100,200,300,400,500,600,700,800,900):return False,"GO bonus cap must be 100-900"
            self.passgo_bonus[pl]={"outer":bonus,"inner":bonus,"cap":cap,"used":0}
            return True,self.pname(f"{pl} gets +{bonus} GO bonus (cap {cap})")

        if m:=re.match(r"!freeloan\s+(\w+)\s+(\d+)\s+(\d+)$",body):
            pl_token,amount,cut=m.groups();amount=int(amount);cut=int(cut)
            pl=self.resolve_player(pl_token)
            if not pl or pl not in self.players:return False,f"{pl_token} is not in the game"
            if amount!=100:return False,"Freeloan amount must be 100"
            if cut not in (20,25,50,100):return False,"Freeloan deduction must be 20,25,50,or 100"
            if pl not in self.free_loans:self.free_loans[pl]={"owed":0,"outer":0,"inner":0}
            self.free_loans[pl]["owed"]+=amount;self.free_loans[pl]["outer"]+=cut;self.free_loans[pl]["inner"]+=cut
            self.players[pl]["money"]+=amount
            return True,self.pname(f"{pl} received ${amount} free loan. Owes ${self.free_loans[pl]['owed']} (-${self.free_loans[pl]['outer']} outer GO / -${self.free_loans[pl]['inner']} inner GO each pass)")
          
        if m:=re.match(r"!auction\s+(\d+)$",body):
            pos=int(m.group(1))
            if not self.players:return False,"No game in progress."
            if not 0<=pos<=63:return False,"Position must be between 0 and 63"
            if pos in self.non_property:return False,f"Position {pos} is not a property"
            prop=self.active_board.get(pos,f"Position {pos}")
            if self.current_auction:return False,"Auction already in progress."
            if pos in self.properties or pos in self.mortgaged:return False,f"Cannot auction {prop}."
            self.active_board[pos]=prop if prop.startswith("x-") else f"x-{prop}"
            self.current_auction={"pos":pos,"bids":{},"last_bidder":None,"bid_timer":None,"active":set(self.players.keys())}
            if self.auction_required:self.auction_required=False
            display_prop=prop[2:] if prop.startswith("x-") else prop
            try:self.sio.emit("updateDisplay2",{"text":f"Auction started for {display_prop}"})
            except Exception:pass
            return True,self.pname(f"Auction started for {display_prop}")
            
        if m:=re.match(r"!bidadd\s+(\d+)$",body):
            if not self.current_auction:return False,None
            inc=int(m.group(1))
            if inc<=0:return False,"Bid must be greater than 0"
            auc=self.current_auction
            active=auc.setdefault("active",set(self.players.keys()))
            player_key=self.resolve_player(caller)
            m_bot=re.match(r"player([1-6])bot$",caller.lower())
            if m_bot and player_key is None:
                player_key=f"p{m_bot.group(1)}"
            if not player_key:return False,f"{caller} is not a valid player."
            if player_key not in active:return False,None
            if auc["bids"] and player_key==max(auc["bids"],key=auc["bids"].get):return False,None
            new_bid=max(auc["bids"].values(),default=0)+inc
            if player_key not in self.players:return False,"Player is no longer in the game"
            if self.players[player_key]["money"]<new_bid:return False,None
            auc["bids"][player_key]=new_bid;auc["last_bidder"]=player_key
            if auc.get("bid_timer"):auc["bid_timer"].cancel()
            def auto_win():
                if self.current_auction!=auc:return
                if player_key not in self.players:return
                if auc["last_bidder"]==player_key and auc["bids"].get(player_key)==new_bid:
                    winner=player_key;amt=new_bid;pos=auc["pos"]
                    self.players[winner]["money"]-=amt
                    self.properties[pos]=winner
                    raw=self.active_board.get(pos,f"Position {pos}")
                    name=raw[2:] if raw.startswith("x-") else raw
                    self.active_board[pos]=f"{winner}-{name}"
                    color=self.unmortgaged_colors.get(winner,"red")
                    wname=self.pname(winner)
                    self.msg_queue.put((self.channel,f"{wname} wins {name} for {amt}"))
                    self.sio.emit("cmd-sound",{"file":"sold.mp3"})
                    self.sio.emit("updateDisplay2",{"text":f"{wname} wins {name} for {amt}"})
                    self.sio.emit("cmd-dot",{"num":pos,"color":color})
                    if auc.get("bid_timer"):auc["bid_timer"].cancel()
                    self.current_auction=None
                    self.auto_up()
            auc["bid_timer"]=threading.Timer(self.auction_timeout,auto_win)
            auc["bid_timer"].daemon=True
            auc["bid_timer"].start()
            prop=self.active_board.get(auc["pos"],f"Position {auc['pos']}")
            prop=prop[2:] if prop.startswith("x-") else prop
            msg=f"{self.pname(player_key)} winning {new_bid} on {prop}"
            self.sio.emit("cmd-sound",{"file":"bid.mp3"})
            self.sio.emit("updateDisplay2",{"text":msg})
            return True,None

        if m:=re.match(r"!fold$",body.lower()):
            if not self.current_auction:return False,None
            auc=self.current_auction
            auc.setdefault("active",set(self.players.keys()))
            player_key=self.resolve_player(caller)
            m_bot=re.match(r"player([1-6])bot$",caller.lower())
            if m_bot and player_key is None:
                player_key=f"p{m_bot.group(1)}"
            if not player_key:return False,f"{caller} is not a valid player."
            if player_key not in auc["active"]:return False,None
            if player_key==auc.get("last_bidder"):return False,None
            auc["active"].discard(player_key);auc["bids"].pop(player_key,None)
            if not auc["active"]:
                pos=auc["pos"];prop=self.active_board.get(pos,f"Position {pos}")
                prop=prop[2:] if prop.startswith("x-") else prop
                if auc.get("bid_timer"):auc["bid_timer"].cancel()
                self.current_auction=None
                self.auto_up()
                return True,f"Auction ended. No bids for {prop}"
            if len(auc["active"])==1:
                winner=next(iter(auc["active"]))
                if winner not in self.players:
                    self.current_auction=None
                    self.auto_up()
                    return True,"Auction ended. Winner no longer exists."
                pos=auc["pos"]
                if auc.get("bid_timer"):auc["bid_timer"].cancel()
                if winner in auc["bids"]:
                    amt=auc["bids"][winner]
                    self.players[winner]["money"]-=amt
                    self.properties[pos]=winner
                    raw=self.active_board.get(pos,f"Position {pos}")
                    name=raw[2:] if raw.startswith("x-") else raw
                    self.active_board[pos]=f"{winner}-{name}"
                    color=self.unmortgaged_colors.get(winner,"red")
                    wname=self.pname(winner)
                    self.msg_queue.put((self.channel,f"{wname} wins {name} for {amt}"))
                    self.sio.emit("cmd-sound",{"file":"sold.mp3"})
                    self.sio.emit("updateDisplay2",{"text":f"{wname} wins {name} for {amt}"})
                    self.sio.emit("cmd-dot",{"num":pos,"color":color})
                    self.current_auction=None
                    self.auto_up()
                    return True,None
                self.current_auction=None
                self.auto_up()
                return True,"Auction ended. No bids."
            return True,f"{self.pname(player_key)} folds"
    
        if m:=re.match(r"!resetauction$",body.lower()):
            if not self.current_auction:return False,"No auction in progress to reset."
            auc=self.current_auction
            if auc.get("bid_timer"):
                auc["bid_timer"].cancel()
                auc["bid_timer"]=None
            pos=auc["pos"]
            raw=self.active_board.get(pos,f"Position {pos}")
            prop=raw[2:] if raw.startswith("x-") else raw
            self.active_board[pos]=f"x-{prop}"
            auc["bids"]={}
            auc["last_bidder"]=None
            auc["active"]=set(self.players.keys())
            msg=f"Auction for {prop} has been RESET. Bidding restarted."
            try:self.sio.emit("updateDisplay2",{"text":msg})
            except Exception:pass
            return True,self.pname(msg)

        if m:=re.match(r"!mortgage\s+(\d+)",body):
            with self.state_lock:
                msg=None
                success=False
                pos=int(m.group(1))
                if self.space62_mortgage_block:
                    msg="Cannot mortgage while a player is on space 62"
                elif self.current_auction:
                    msg="Cannot mortgage during an auction"
                elif pos not in self.properties:
                    msg=f"Position {pos} is not owned"
                else:
                    owner=self.properties[pos]
                    owner_display=self.pname(owner)
                    caller_player=next((k for k,s in self.aliases.items() if caller in s or caller==k),caller)
                    if caller_player!=owner:
                        msg=f"Only the owner ({owner_display}) can mortgage this property"
                    elif pos in self.mortgaged:
                        msg=f"Property {pos} is already mortgaged"
                    elif any(self.houses.get(x,0)>0 for group in self.color_sets.values() if pos in group for x in group):
                        msg=f"Cannot mortgage property {pos} because the color set has houses"
                    else:
                        val=self.mortgage_table.get(pos,0)
                        if val<=0:
                            msg=f"Property {pos} cannot be mortgaged"
                        else:
                            self.players[owner]['money']+=val
                            self.mortgaged.add(pos)
                            old=self.active_board.get(pos,f"Position {pos}")
                            name=old.split('-',1)[-1] if '-' in old else old
                            pref=f"m{owner[-1]}" if owner.startswith("p") else f"m-{owner}"
                            self.active_board[pos]=f"{pref}-{name}"
                            msg=f"mortgaged {owner_display} {name} for {val}"
                            success=True
                            self.sio.emit("cmd-sound",{"file":"mortgage.mp3"})
                            self.sio.emit("cmd-dot",{"num":pos,"color":self.mortgaged_colors.get(owner,"black")})
                if msg:
                    self.connection.privmsg(self.channel,msg)
                if success:
                    self.auto_up()
            return True,None

        if m:=re.match(r"!redeem\s+(\d+)",body):
            with self.state_lock:
                msg=None
                success=False
                pos=int(m.group(1))
                if self.current_auction:
                    msg="Cannot redeem/unmortgage during an auction"
                elif pos not in self.properties:
                    msg=f"Position {pos} is not owned."
                else:
                    owner=self.properties[pos]
                    owner_display=self.pname(owner)
                    caller_player=next((k for k,s in self.aliases.items() if caller in s or caller==k),caller)
                    if caller_player!=owner:
                        msg=f"Only the owner ({owner_display}) can redeem this property"
                    elif pos not in self.mortgaged:
                        msg=f"Property {pos} is not mortgaged."
                    else:
                        cost=self.mortgage_table.get(pos,0)
                        interest=int(cost*0.10)
                        total=cost+interest
                        if self.players[owner]['money']<total:
                            msg=f"{owner_display} does not have enough money to unmortgage {pos} ({total})"
                        else:
                            self.players[owner]['money']-=total
                            self.mortgaged.remove(pos)
                            old=self.active_board.get(pos,f"Position {pos}")
                            name=old.split('-',1)[-1] if '-' in old else old
                            self.active_board[pos]=f"{owner}-{name}"
                            msg=f"redeemed {owner_display} {name} for {total} ({cost} + 10% interest)"
                            success=True
                            self.sio.emit("cmd-sound",{"file":"redeem.mp3"})
                            self.sio.emit("cmd-dot",{"num":pos,"color":self.unmortgaged_colors.get(owner,"red")})
                if msg:
                    self.connection.privmsg(self.channel,msg)
                if success:
                    self.auto_up()
            return True,None
            
        m=re.match(r"!addonehouse\s+(\d+)",body)
        if m:
            if self.current_auction:return False,"Cannot add houses during an auction"
            pos=int(m.group(1))
            color=next((c for c,props in self.color_sets.items() if pos in props),None)
            if color is None:return False,f"Position {pos} is not part of a color set"
            props=self.color_sets[color];owners=[self.properties.get(x) for x in props]
            if None in owners or any(isinstance(o,str) and o.startswith("x-") for o in owners if o):
                missing=[str(x) for x,o in zip(props,owners) if o is None or (isinstance(o,str) and o.startswith("x-"))]
                return False,f"Cannot add houses: unowned properties in set: {', '.join(missing)}"
            if len(set(owners))!=1:return False,f"Cannot add houses: not all properties in {color} set are owned by the same player"
            owner=owners[0];caller_key=next((k for k,s in self.aliases.items() if caller in s or caller==k),caller)
            if caller_key!=owner:return False,f"Only the owner ({self.pname(owner)}) or their alias can add houses to this set"
            mort=[str(x) for x in props if x in self.mortgaged]
            if mort:return False,f"Cannot add houses: these properties are mortgaged: {', '.join(mort)}"
            if self.houses.get(pos,0)>=5:return False,f"Cannot add house: property {pos} already at max (5)"
            min_houses=min(self.houses.get(x,0) for x in props)
            if self.houses.get(pos,0)>min_houses:
                lowest=[str(x) for x in props if self.houses.get(x,0)==min_houses]
                return False,f"Must build evenly: add to {', '.join(lowest)} first (fewest houses in {color} set)"
            cost=self.house_costs.get(color,0)
            if self.players[owner]['money']<cost:return False,f"{self.pname(owner)} does not have enough money to buy a house ({cost} required)"
            self.players[owner]['money']-=cost
            self.houses[pos]=self.houses.get(pos,0)+1
            self.sio.emit("cmd-sound",{"file":"build1.mp3"})
            try:self.handle_command(caller,"!housestatus")
            except Exception:pass
            return True,self.pname(f"Added 1 house to property {pos} in {color} set. {owner} charged {cost}")

        m=re.match(r"!removeonehouse\s+(\d+)",body)
        if m:
            if self.current_auction:return False,"Cannot remove houses during an auction"
            pos=int(m.group(1))
            color=next((c for c,props in self.color_sets.items() if pos in props),None)
            if color is None:return False,f"Position {pos} is not part of a color set"
            props=self.color_sets[color];owners=[self.properties.get(x) for x in props]
            if None in owners or any(isinstance(o,str) and o.startswith("x-") for o in owners if o):
                missing=[str(x) for x,o in zip(props,owners) if o is None or (isinstance(o,str) and o.startswith("x-"))]
                return False,f"Cannot remove houses: unowned properties in set: {', '.join(missing)}"
            if len(set(owners))!=1:return False,f"Cannot remove houses: not all properties in {color} set are owned by the same player"
            owner=owners[0];caller_key=next((k for k,s in self.aliases.items() if caller in s or caller==k),caller)
            if caller_key!=owner:return False,f"Only the owner ({self.pname(owner)}) or their alias can remove houses from this set"
            if self.houses.get(pos,0)<=0:return False,f"Cannot remove house: property {pos} already has 0 houses"
            max_houses=max(self.houses.get(x,0) for x in props)
            if self.houses.get(pos,0)<max_houses:
                highest=[str(x) for x in props if self.houses.get(x,0)==max_houses]
                return False,f"Must remove evenly: remove from {', '.join(highest)} first (most houses in {color} set)"
            refund=self.house_costs.get(color,0)//2
            self.players[owner]['money']+=refund
            self.houses[pos]=max(0,self.houses.get(pos,0)-1)
            self.sio.emit("cmd-sound",{"file":"destroy1.mp3"})
            try:self.handle_command(caller,"!housestatus")
            except Exception:pass
            return True,self.pname(f"Removed 1 house from property {pos} in {color} set. {owner} refunded {refund}")

        m=re.match(r"!save\s*(\S+)?",body)
        if m:
            fn=m.group(1)or"1.pkl"
            state={
                "players":self.players,
                "properties":self.properties,
                "houses":self.houses,
                "mortgaged":self.mortgaged,
                "aliases":self.aliases,
                "custom_names":self.custom_names,
                "current_auction":self.current_auction,
                "current_trade":self.current_trade,
                "active_board":self.active_board,
                "non_property":self.non_property,
                "num_players":self.num_players,
                "max_pos":self.max_pos,
                "jailed":self.jailed,
                "consecutive_doubles":self.consecutive_doubles,
                "dice4_streak":self.dice4_streak,
                "switch_required":self.switch_required,
                "auction_required":self.auction_required,
                "dice_rolls":self.dice_rolls,
                "passgo_bonus":self.passgo_bonus,
                "free_loans":self.free_loans,
                "go_jail_attempts":self.go_jail_attempts
            }
            try:
                with open(fn,"wb")as f:pickle.dump(state,f)
                return True,self.pname(f"Game state saved to '{fn}'")
            except Exception as e:return False,f"Failed to save game: {e}"

        m=re.match(r"!restore\s*(\S+)?",body)
        if m:
            fn=m.group(1)or"1.pkl"
            if not os.path.exists(fn):return False,f"File '{fn}' not found"
            try:
                with open(fn,"rb")as f:state=pickle.load(f)

                self.players=state.get("players",{})
                self.properties=state.get("properties",{})
                self.houses=state.get("houses",{})
                self.mortgaged=state.get("mortgaged",set())
                self.aliases={k:set(v)for k,v in state.get("aliases",{}).items()}
                self.custom_names=state.get("custom_names",{})
                self.current_auction=state.get("current_auction")
                self.current_trade=state.get("current_trade")
                self.active_board=self.board_regular.copy()
                if state.get("max_pos",39)>39:
                    self.active_board.update(self.board_deep)
                self.non_property=state.get("non_property",set())
                self.num_players=state.get("num_players",len(self.players))
                self.max_pos=state.get("max_pos",39)
                self.jailed=state.get("jailed",{})
                self.consecutive_doubles=state.get("consecutive_doubles",{})
                self.dice4_streak=state.get("dice4_streak",{})
                self.switch_required=state.get("switch_required",False)
                self.auction_required=state.get("auction_required",False)
                self.dice_rolls=state.get("dice_rolls",{})
                self.passgo_bonus=state.get("passgo_bonus",{})
                self.free_loans=state.get("free_loans",{})
                self.go_jail_attempts=state.get("go_jail_attempts",{})
                try:
                    self.handle_command("restorebot","!propertylist")
                    self.handle_command("restorebot","!housestatus")
                    self.auto_up()
                except Exception:
                    pass
                return True,f"Game state restored from '{fn}'"
            except Exception as e:return False,f"Failed to restore game: {e}"

        m=re.match(r"!offer-(\w+)\s+(.+)",body)
        if m:
            offerer_token=m.group(1).lower();text=m.group(2).strip();offerer=self.resolve_player(offerer_token)
            if not offerer:return False,f"{offerer_token} is not a valid player."
            if offerer not in self.players:return False,f"{offerer_token} is not in the game."
            if self.current_trade:return False,"A trade is already active. !accept or !reject it first."
            parts=text.split()
            other_index=None
            other=None
            for i,p in enumerate(parts):
                temp=self.resolve_player(p)
                if temp and temp!=offerer:
                    other_index=i
                    other=temp
                    break
            if not other:return False,"Other player not in game."
            left_tokens=parts[:other_index]
            right_tokens=parts[other_index+1:]
            def parse_side(tokens):
                props=[];money=0
                for t in tokens:
                    if t.startswith("money:"):
                        try:money+=int(t.split(":",1)[1])
                        except:pass
                    else:
                        for p in t.split(","):
                            if p.strip().isdigit():props.append(int(p.strip()))
                return props,money
            left_props,left_money=parse_side(left_tokens)
            right_props,right_money=parse_side(right_tokens)
            for pos in left_props+right_props:
                if pos not in self.active_board or pos in self.non_property:
                    return False,f"Property {pos} is not a valid property."
            def validate_houses(prop_list):
                for pos in prop_list:
                    if self.houses.get(pos,0)>0:
                        for color,group in self.color_sets.items():
                            if pos in group and not set(group).issubset(set(prop_list)):
                                return f"Property {pos} has houses; must trade entire color set: {group}"
                return None
            err=validate_houses(left_props)
            if err:return False,err
            err=validate_houses(right_props)
            if err:return False,err
            for pos in left_props:
                if self.properties.get(pos)!=offerer:return False,f"{self.pname(offerer)} does not own property {pos}"
            for pos in right_props:
                if self.properties.get(pos)!=other:return False,f"{self.pname(other)} does not own property {pos}"
            self.current_trade={"offerer":offerer,"other":other,"left_props":left_props,"left_money":left_money,"right_props":right_props,"right_money":right_money}
            return True,self.pname(f"Trade offer created: {offerer} gives {left_props} + ${left_money} for {other}'s {right_props} + ${right_money}. {other} must !accept or !reject.")

        if body.lower()=="!accept":
            if not self.current_trade:return False,"No active trade."
            t=self.current_trade
            if t["left_money"]>0 and self.players[t["offerer"]]["money"]<t["left_money"]:return False,f"{self.pname(t['offerer'])} does not have enough money."
            if t["right_money"]>0 and self.players[t["other"]]["money"]<t["right_money"]:return False,f"{self.pname(t['other'])} does not have enough money."
            self.players[t["offerer"]]["money"]-=t["left_money"]
            self.players[t["other"]]["money"]+=t["left_money"]
            self.players[t["other"]]["money"]-=t["right_money"]
            self.players[t["offerer"]]["money"]+=t["right_money"]
            def transfer(props,old,new):
                for pos in props:
                    self.properties[pos]=new
                    raw=self.active_board.get(pos,f"Position {pos}")
                    nm=raw.split("-",1)[-1] if "-" in raw else raw
                    self.active_board[pos]=f"{new}-{nm}"
            transfer(t["left_props"],t["offerer"],t["other"])
            transfer(t["right_props"],t["other"],t["offerer"])
            self.current_trade=None
            try:
                self.handle_command("tradebot","!propertylist")
                self.handle_command("tradebot","!housestatus")
            except Exception:
                pass
            return True,"Trade accepted and completed."

        if body.lower()=="!reject":
            if not self.current_trade:return False,"No active trade."
            self.current_trade=None
            return True,"Trade rejected."

        return True,None

    def move_player(self,p,sp):
        if p not in self.players:return "","Player not found"
        display=self.pname(p)
        def play_rent_sound():self.sio.emit("cmd-sound",{"file":"rent.mp3"})
        old=self.players[p]["pos"];in_reg=old<=39
        new=(old+sp)%40 if in_reg else ((old-40+sp)%24)+40
        if self.jailed.get(p,False) and old==10 and sp>0:
            self.jailed[p]=False;self.connection.privmsg(self.channel,f"{display} is now out of jail")
        bonus_data=self.passgo_bonus.get(p);loan=self.free_loans.get(p);loan_msg="";bonus_msg=""
        if in_reg and old+sp>39:
            base=200;extra=0
            if bonus_data:
                rem=max(0,bonus_data["cap"]-bonus_data["used"]);extra=min(bonus_data["outer"],rem);bonus_data["used"]+=extra
                if extra:bonus_msg=f" GO bonus +{extra}"
            self.players[p]["money"]+=base+extra
            if loan and loan["owed"]>0:
                pay=min(loan["outer"],loan["owed"]);self.players[p]["money"]-=pay;loan["owed"]-=pay;loan_msg=f" Loan payment -{pay}"
                if loan["owed"]<=0:self.free_loans.pop(p,None)
        elif not in_reg and old-40+sp>=24:
            base=100;extra=0
            if bonus_data:
                rem=max(0,bonus_data["cap"]-bonus_data["used"]);extra=min(bonus_data["inner"],rem);bonus_data["used"]+=extra
                if extra:bonus_msg=f" GO bonus +{extra}"
            self.players[p]["money"]+=base+extra
            if loan and loan["owed"]>0:
                pay=min(loan["inner"],loan["owed"]);self.players[p]["money"]-=pay;loan["owed"]-=pay;loan_msg=f" Loan payment -{pay}"
                if loan["owed"]<=0:self.free_loans.pop(p,None)
        self.players[p]["pos"]=new;name=self.active_board.get(new,f"Position {new}")
        owner=self.properties.get(new);msg="";fee=0
        def send_msg(m):
            if m:
                self.connection.privmsg(self.channel,msg+bonus_msg+loan_msg)
                self.sio.emit("updateDisplay2",{"text":f"{msg}{bonus_msg}{loan_msg}"})
        rails={5:43,15:49,25:55,35:61,43:5,49:15,55:25,61:35}
        if new in rails:
            if new in (5,15,25,35):
                owner=self.properties.get(new)
                if not owner and str(self.active_board.get(new,"")).startswith("x-") and not self.current_auction:
                    self.current_auction={"pos":new,"bids":{},"last_bidder":None,"bid_timer":None,"active":set(self.players.keys())}
                    raw=self.active_board.get(new,"")
                    msg+=f"Auction started for {raw[2:] if raw.startswith('x-') else raw}."
                elif owner and owner!=p:
                    if new in self.mortgaged:msg+="Property is mortgaged, no rent"
                    elif self.jailed.get(owner,False):msg+="Owner in jail, no rent"
                    else:
                        rc=[x for x in (5,15,25,35) if self.properties.get(x)==owner and x not in self.mortgaged]
                        rent={1:25,2:50,3:100,4:200}.get(len(rc),25)
                        self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f"{display} pays {rent} to {self.pname(owner)}"
            if self.max_pos>39:
                target=rails[new];self.players[p]["pos"]=target;new=target;name=self.active_board.get(new,f"Position {new}")
                owner=self.properties.get(new)
                if owner and owner!=p:
                    if new in self.mortgaged:msg+="Property is mortgaged, no rent"
                    elif self.jailed.get(owner,False):msg+="Owner in jail, no rent"
                    else:
                        rc=[x for x in (5,15,25,35) if self.properties.get(x)==owner and x not in self.mortgaged]
                        rent={1:25,2:50,3:100,4:200}.get(len(rc),25)
                        self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f"{display} pays {rent} to {self.pname(owner)}"
        total_houses=sum(h for pos,h in self.houses.items() if self.properties.get(pos)==p)
        total_props=sum(1 for o in self.properties.values() if o==p)
        if new in (2,18,36,48):
            self.players[p]["money"]+=50;msg+=f"{display} received +50";self.sio.emit("cmd-sound",{"file":"bonus.mp3"})
        elif new in (7,60):
            fee=total_houses*5+total_props*5;self.players[p]["money"]-=fee;msg+=f"{display} pays {fee}";self.sio.emit("cmd-sound",{"file":"tax.mp3"})
        elif new==23:
            fee=total_houses*5+max(0,int(self.players[p]["money"]*0.05));self.players[p]["money"]-=fee;msg+=f"{display} pays {fee}";self.sio.emit("cmd-sound",{"file":"tax.mp3"})
        elif new==32:
            unmortgaged=sum(1 for pos,o in self.properties.items() if o==p and pos not in self.mortgaged)
            mortgaged=sum(1 for pos,o in self.properties.items() if o==p and pos in self.mortgaged)
            fee=unmortgaged*10+mortgaged*5;self.players[p]["money"]-=fee;msg+=f"{display} pays {fee}";self.sio.emit("cmd-sound",{"file":"tax.mp3"})
        elif new==20:
            self.handle_command("dicebot",f"!freeloan {p} 100 50")
            msg+=f"{display} received 100 free loan"
            self.sio.emit("cmd-sound",{"file":"bonus.mp3"})
        elif new==62:
            self.space62_mortgage_block=True
            self.space62_mortgage_unlock_on_roll=True
            msg+=f"{display} can auction any unowned property"
        elif new==30:
            self.jailed[p]=True
            self.players[p]["pos"]=10
            msg=f"{display} goes to jail"
            self.sio.emit("cmd-sound",{"file":"jail.mp3"})
            send_msg(f"{display} {msg}")
            return "Jail",msg
        if new==54:
            self.switch_required=True
            msg+=f"{display} must use switch"
        if owner and owner!=p:
            if new in self.mortgaged:msg+="Property is mortgaged, no rent"
            elif self.jailed.get(owner,False):msg+="Owner in jail, no rent"
            else:
                if new in (4,13,27,38):
                    group=(4,13,27,38);u=[x for x in group if self.properties.get(x)==owner and x not in self.mortgaged]
                    mult={1:4,2:8,3:16,4:25}.get(len(u),4);rent=abs(sp)*mult
                    self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f"{display} pays to {self.pname(owner)} {sp}*{mult}={rent}"
                elif new in (40,46,52,58):
                    group=(40,46,52,58);u=[x for x in group if self.properties.get(x)==owner and x not in self.mortgaged]
                    mult={1:4,2:8,3:16,4:30}.get(len(u),5);rent=abs(sp)*mult
                    self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f"{display} pays to {self.pname(owner)} {sp}*{mult}={rent}"
                else:
                    hc=self.houses.get(new,0);rents=self.house_rents.get(new,[0]);hc=min(hc,len(rents)-1);rent=rents[hc]
                    for color,props in self.color_sets.items():
                        if new in props:
                            if all(self.properties.get(x)==owner for x in props) and all(self.houses.get(x,0)==0 for x in props):rent*=2
                            break
                    self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f"{display} pays {rent} to {self.pname(owner)}"
        if new not in self.non_property and str(self.active_board.get(new,"")).startswith("x-") and new not in self.properties and not self.current_auction and new not in (43,49,55,61):
            self.current_auction={"pos":new,"bids":{},"last_bidder":None,"bid_timer":None,"active":set(self.players.keys())}
            raw=self.active_board.get(new,"")
            prop=raw[2:] if raw.startswith("x-") else raw
            try:self.sio.emit("updateDisplay2",{"text":f"Auction started for {prop}"})
            except:pass
            return name,""
        if msg:
            self.connection.privmsg(self.channel,msg+bonus_msg+loan_msg)
            self.sio.emit("updateDisplay2",{"text":f"{self.pname(msg)}{bonus_msg}{loan_msg}"})
        return name,self.pname(msg)
    # -------- Dice0-4 --------
    def _handle_dice_pub(self,c,nick,msg):
        m=msg.strip().lower()
        if self.current_auction and re.match(r"!dice[0-4]-(\w+)",m):return
        if re.match(r"!dice[0-4]-(\w+)",m) and any(p["money"]<0 for p in self.players.values()):c.privmsg(self.channel,"Dice disabled negative balance");return
        if x:=re.match(r"!dicestart(?:\s+(\d))?",m):self._handle_dicestart(c,x);return
        if m.startswith("!dicestop"):self._handle_dicestop(c);return
        if x:=re.match(r"!dicedisable\s+([0-4])",m):self._handle_dicedisable(c,int(x.group(1)));return
        if m.startswith("!diceoverride"):self._handle_diceoverride(c,nick);return
        if x:=re.match(r"!diceadd\s+(\w+)",m):
            pl=self.resolve_player(x.group(1))
            if pl:self._handle_diceadd(c,int(pl[1:]))
            return
        if x:=re.match(r"!diceremove\s+(\w+)",m):
            pl=self.resolve_player(x.group(1))
            if pl:self._handle_diceremove(c,int(pl[1:]))
            return
        for d in("dice0","dice1","dice2","dice3","dice4"):
            if x:=re.match(rf"!{d}-(\w+)",m):
                pl=self.resolve_player(x.group(1))
                if pl:self._handle_dice_command(c,d,int(pl[1:]),nick)
                return
    def _handle_dicestart(self,c,m):
        if isinstance(m,int):n=m
        else:
            if not m.group(1):c.privmsg(self.channel,"Usage: !dicestart <2-6>");return
            n=int(m.group(1))
        if not 2<=n<=6:c.privmsg(self.channel,"Number of players must be 2-6");return
        with self.dice_lock:
            self.dice_mode=True
            self.dice_players=n
            self.dice_order=list(range(1,n+1))
            self.expected_player_index=0
            self.dice_override=False
            self.disabled_dice.clear()
        c.privmsg(self.channel,f"Dice mode started for {n} players. Order: {', '.join(self.pname(f'p{x}') for x in self.dice_order)}")
    def _handle_dicestop(self,c):
        with self.dice_lock:self.dice_mode=False;self.dice_players=None;self.dice_order=[];self.expected_player_index=0;self.dice_override=False;self.disabled_dice.clear()
        c.privmsg(self.channel,"Dice mode stopped. Dice commands disabled.")
    def _handle_diceoverride(self,c,nick):
        with self.dice_lock:
            if not self.dice_mode:c.privmsg(self.channel,"Dice mode not active.");return
            self.dice_override=True
        c.privmsg(self.channel,"Diceoverride activated. Any player may roll next.")
    def _handle_dicedisable(self,c,d):
        with self.dice_lock:
            if not self.dice_mode:c.privmsg(self.channel,"Dice mode not active.");return
            self.disabled_dice.add(f"dice{d}")
        c.privmsg(self.channel,f"dice{d} disabled for this dice session.")
    def _handle_diceremove(self,c,pn):
        with self.dice_lock:
            if not self.dice_mode:c.privmsg(self.channel,"Dice mode not active.");return
            pl_key=f"p{pn}";display=self.pname(pl_key)
            if pn not in self.dice_order:c.privmsg(self.channel,f"Player {display} not in order");return
            i=self.dice_order.index(pn);self.dice_order.pop(i)
            if i<=self.expected_player_index and self.expected_player_index>0:self.expected_player_index-=1
            if not self.dice_order:
                self.dice_mode=False;c.privmsg(self.channel,"All players removed. Dice mode stopped.");return
            self.expected_player_index%=len(self.dice_order)
        c.privmsg(self.channel,f"Player {display} removed. Order: {', '.join(self.pname(f'p{x}') for x in self.dice_order)}")
    def _handle_diceadd(self,c,pn):
        with self.dice_lock:
            if not self.dice_mode:c.privmsg(self.channel,"Dice mode not active.");return
            pl_key=f"p{pn}";display=self.pname(pl_key)
            if pl_key not in self.players:c.privmsg(self.channel,f"Player {display} is not in the game.");return
            if pn in self.dice_order:c.privmsg(self.channel,f"Player {display} already in dice order.");return
            cur=self.dice_order[self.expected_player_index] if self.dice_order and self.expected_player_index<len(self.dice_order) else None
            self.dice_order.append(pn);self.dice_order.sort()
            if cur is not None and cur in self.dice_order:self.expected_player_index=self.dice_order.index(cur)
            elif self.dice_order:self.expected_player_index%=len(self.dice_order)
        c.privmsg(self.channel,f"Player {display} added. Order: {', '.join(self.pname(f'p{x}') for x in self.dice_order)}")
    def _next_turn_label(self):
        if not self.dice_order:return "?'s Turn to Roll"
        player_id=self.dice_order[self.expected_player_index%len(self.dice_order)]
        return f"{self.pname(f'p{player_id}')}'s Turn to Roll"
    def _handle_dice_command(self,c,d,p,nick):
        pl_key=f"p{p}";display=self.pname(pl_key)
        if self.switch_required:c.privmsg(self.channel,"Must use !switch before next dice roll.");return
        with self.dice_lock:
            if not self.dice_mode:c.privmsg(self.channel,"Dice commands disabled. Use !dicestart <number of players>");return
            if d in self.disabled_dice:c.privmsg(self.channel,f"{d} is currently disabled.");return
            if p not in self.dice_order:c.privmsg(self.channel,f"{display} not active.");return
            exp=self.dice_order[self.expected_player_index];expname=self.pname(f"p{exp}")
            if not(self.dice_override or p==exp):c.privmsg(self.channel,f"Not your turn. Next: {expname}. Use !diceoverride to allow.");return
            if self.dice_override:self.dice_override=False;self.expected_player_index=self.dice_order.index(p)
            if d=="dice4":
                if not self.jailed.get(pl_key,False):c.privmsg(self.channel,f"{display} cannot use !dice4. Not in jail.");return
            elif self.jailed.get(pl_key,False):c.privmsg(self.channel,f"{display} is in jail. Only !dice4 can be used.");return
            self.dice4_streak[pl_key]=self.dice4_streak.get(pl_key,0)+1 if d=="dice4" else 0
            if self.space62_mortgage_unlock_on_roll:
                self.space62_mortgage_block=False
                self.space62_mortgage_unlock_on_roll=False
        getattr(self,f"_handle_{d}",lambda*a:None)(c,p)
        if d=="dice4" and self.dice4_streak.get(pl_key,0)>=3 and self.jailed.get(pl_key,False):
            self.dice4_streak[pl_key]=0;self.jailed[pl_key]=False
            c.privmsg(self.channel,f"{display} rolled dice4 three times in a row. Released from jail for free.")
            try:self.sio.emit("cmd-sound",{"file":"key.mp3"})
            except:pass
        with self.dice_lock:
            r=self.dice_rolls.get(p)
            if r and r[0]!=r[1]:
                self.expected_player_index=(self.expected_player_index+1)%len(self.dice_order)
                
    def _handle_dice0(self,c,p):self._roll_and_handle(c,p,[1,2,3,4,5,6],[1,2,3,4,5,6],"dice0",True)
    def _handle_dice1(self,c,p):self._roll_and_handle(c,p,[1,1,2,2,3,3],[1,1,2,2,3,3],"dice1",True)
    def _handle_dice2(self,c,p):self._roll_and_handle(c,p,[1,1,2,2,3,3],[4,4,5,5,6,6],"dice2",True)
    def _handle_dice3(self,c,p):self._roll_and_handle(c,p,[4,4,5,5,6,6],[4,4,5,5,6,6],"dice3",True)
    def _handle_dice4(self,c,p):self._roll_and_handle(c,p,[1,2,3,4,5,6],[1,2,3,4,5,6],"dice4",False)
    def _roll_and_handle(self,c,p,p1,p2,d,nl=True):
        f,s=random.choice(p1),random.choice(p2);t=f+s;pl=f"p{p}";display=self.pname(pl);dbl=f==s
        sound="dice.mp3" if d=="dice4" else "click.mp3"
        if pl not in self.players:return
        self.dice_rolls[p]=(f,s);self.consecutive_doubles[pl]=self.consecutive_doubles.get(pl,0)+1 if dbl else 0
        c.privmsg(self.channel,f"{d} rolled by {display} {f}+{s}")
        if self.consecutive_doubles[pl]>=CONSECUTIVE_DOUBLES_FOR_TELEPORT:
            self.consecutive_doubles[pl]=0;c.privmsg(self.channel,f"{display} rolled doubles twice. Turn lost")
            try:self.handle_command("dicebot",f"!teleport {pl} 10");c.privmsg(self.channel,f"{display} was teleported to position 10 jail");self.jailed[pl]=True
            except:pass
            try:self.sio.emit("cmd-sound",{"file":"jail.mp3"})
            except:pass
            threading.Timer(0.1,lambda:self.sio.emit("updateDisplay1",{"text":self._next_turn_label()})).start()
            threading.Timer(0.2,lambda:self.handle_command("dicebot","!up")).start()
            with self.dice_lock:
                if self.dice_mode and self.dice_order:self.expected_player_index=(self.expected_player_index+1)%len(self.dice_order)
            try:self.sio.emit("cmd-sound",{"file":"click.mp3"})
            except:pass
            return
        if nl or dbl:
            try:self.sio.emit("cmd-sound",{"file":sound})
            except:pass
            try:self.handle_command("dicebot",f"!move {pl} {t}")
            except:pass
            threading.Timer(0.1,lambda:self.sio.emit("updateDisplay1",{"text":f"Double for {display}: Go Again" if dbl else self._next_turn_label()})).start()
            threading.Timer(0.2,lambda:self.handle_command("dicebot","!up")).start()
        else:
            threading.Timer(0.3,lambda:self.sio.emit("updateDisplay1",{"text":self._next_turn_label()})).start()
            try:self.sio.emit("cmd-sound",{"file":sound})
            except:pass
    # --- GO SYSTEM ---
    def handle_go_session_command(self,c,nick,msg):
        if msg.startswith('!gostart'):
            if self.go_enabled:c.privmsg(self.channel,"GO session already started");return
            self.go_enabled=True;self.turn='p1';self.override_next_turn=False
            c.privmsg(self.channel,f"GO session started. Turn: {self.turn}")
        elif msg.startswith('!gostop'):
            if not self.go_enabled:c.privmsg(self.channel,"No active GO session");return
            self.go_enabled=False
            if self.go_active:
                if self.go_timer:self.go_timer.cancel();self.go_timer=None
                self.go_active=None;self.go_numbers={};self.go_owner=None
                if self.go_lock.locked():self.go_lock.release()
            c.privmsg(self.channel,"GO session stopped")
    def override_turn(self,c,nick,msg):
        if msg=='!gooverride':
            if self.go_active:
                c.privmsg(self.channel,f"{nick} used GO override !go{self.go_active} stopped")
                if self.go_timer:self.go_timer.cancel();self.go_timer=None
                self.go_active=None;self.go_numbers={};self.go_owner=None
                if self.go_lock.locked():self.go_lock.release()
            self.override_next_turn=True
            c.privmsg(self.channel,f"{nick} used GO override Next turn open")
    def announce_go_turn(self,c,player):
        text=f"Player - {1 if player=='p1' else 2} - Turn"
        self.sio.emit("updateDisplay1",{"text":text})
    def handle_go_command(self,c,msg,nick):
        m=re.match(r"!go([1-4])(?:\s+(\d+))?",msg)
        if not m:return
        if self.current_auction:c.privmsg(self.channel,"GO disabled during an active auction.");return
        if self.players and self.any_player_negative():c.privmsg(self.channel,"GO disabled: negative balance.");return
        if not self.go_enabled:c.privmsg(self.channel,f"{nick}, use !gostart first");return
        cmd=m.group(1)
        if nick in self.aliases.get('p1',[]) or nick=='p1':p='p1'
        elif nick in self.aliases.get('p2',[]) or nick=='p2':p='p2'
        else:c.privmsg(self.channel,f"{nick}, not allowed");return
        if (p=='p1' and cmd not in ('1','3')) or (p=='p2' and cmd not in ('2','4')):
            c.privmsg(self.channel,f"{nick}, wrong GO command");return
        jail=self.jailed.get(p,False)
        if cmd in ('1','2') and jail:
            other=3 if p=='p1' else 4
            c.privmsg(self.channel,f"{nick}, you are in jail. Use !go{other} or !jailpay {p}");return
        if cmd in ('3','4') and not jail:
            other=1 if p=='p1' else 2
            c.privmsg(self.channel,f"{nick}, not in jail. Use !go{other}");return
        if not self.override_next_turn and self.turn!=p:
            c.privmsg(self.channel,f"{nick}, not your turn. Use !gooverride");return
        self.override_next_turn=False;self.go_owner=p;self.start_go(c,m)

    def handle_go_privmsg(self,c,user,msg):
        if not self.go_active or user not in self.go_input_users:return
        if msg.lower().startswith("!go"):return
        if msg.startswith("!") and msg[1:].isdigit():msg=msg[1:]
        if not msg.isdigit() or not 0<=int(msg)<=7:c.privmsg(user,"number must be 0-7");return
        self.go_numbers[user]=int(msg)
        c.privmsg(user,f"number received for !go{self.go_active}")
        if user.lower() in ("p1","p2"):
            try:self.sio.emit("cmd-sound",{"file":"click.mp3" if user.lower()=="p1" else "dice.mp3"})
            except:pass
        if len(self.go_numbers)==len(self.go_input_users):self.end_go(c,"completed")

    def start_go(self,c,m):
        if not self.go_lock.acquire(blocking=False):c.privmsg(self.channel,"Another GO is active");return
        self.go_active=m.group(1);self.go_numbers={}
        t=int(m.group(2)) if m.group(2) else 60
        c.privmsg(self.channel,f"Command !go{self.go_active} started. Waiting for numbers. Timeout: {t}s")
        if self.go_timer:self.go_timer.cancel()
        self.go_timer=threading.Timer(t,self.timeout,[c]);self.go_timer.start()
    def timeout(self,c):
        x=[u for u in self.go_input_users if u not in self.go_numbers]
        if x:c.privmsg(self.channel,f"Command !go{self.go_active} timed out. Missing: {', '.join(x)}")
        self.end_go(c,"timeout")
    def end_go(self,c,reason):
        nums=[self.go_numbers.get(u,0) for u in self.go_input_users]
        total=sum(nums)
        double=nums[0]==nums[1]
        if reason=="completed" and len(self.go_numbers)==len(self.go_input_users):
            p='p1' if self.go_active in ('1','3') else 'p2'
            jail=self.go_active in ('3','4')
            if jail and self.jailed.get(p,False) and not double:
                self.go_jail_attempts[p]+=1
                if self.go_jail_attempts[p]>=3:
                    self.jailed[p]=False
                    self.go_jail_attempts[p]=0
                    c.privmsg(self.channel,f"{p} used !go{self.go_active} three times. Released from jail for free.")
                    try:self.sio.emit("cmd-sound",{"file":"key.mp3"})
                    except:pass
            else:self.go_jail_attempts[p]=0
            if jail and not double:
                c.privmsg(self.channel,f"Command !go{self.go_active} requires doubles. Dice: {nums[0]} and {nums[1]}")
                self.turn='p2' if p=='p1' else 'p1'
                c.privmsg(self.channel,f"Turn switched to {self.turn}")
                self.announce_go_turn(c,self.turn)
            else:
                self.handle_command("dicebot",f"!move {p} {total}")
                c.privmsg(self.channel,f"Dice results: {nums[0]} and {nums[1]}")
                if double:
                    self.sio.emit("updateDisplay1",{"text":f"Double for (P{1 if p=='p1' else 2}): go again"})
                else:
                    next_player='p2' if p=='p1' else 'p1'
                    self.announce_go_turn(c,next_player)
                self.handle_command("dicebot","!up")
                self.turn=p if double else ('p2' if p=='p1' else 'p1')
        if self.go_timer:
            self.go_timer.cancel()
            self.go_timer = None
        self.go_active = None
        self.go_numbers = {}
        if self.go_lock.locked():
            self.go_lock.release()

if __name__=="__main__":
    bot=MonopolyBot(ws_url=os.environ.get("RENTO_WS_URL"))
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass
