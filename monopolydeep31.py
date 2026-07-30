import re, random, pickle, os, time, threading, queue
from irc.bot import SingleServerIRCBot
from irc.connection import Factory
CONSECUTIVE_DOUBLES_FOR_TELEPORT = 3
class MonopolyBot(SingleServerIRCBot):
    def __init__(self, ch, nick, server, port, users=None, num_players=4):
        super().__init__([(server, port)], nick, nick, connect_factory=Factory(ipv6=True))
        self.channel = ch.lower()
        self.board_regular = {0:"Start",1:"x-Libya",2:"Chest",3:"x-Sudan",4:"x-UtilityOne",5:"x-StationJapan",6:"x-Turkey",7:"Clover",8:"x-Greece",9:"x-Bulgaria",10:"Jail",11:"x-Poland",12:"x-Russia",13:"x-UtilityTwo",14:"x-Ukraine",15:"x-StationSpain",16:"x-Lithuania",17:"x-Latvia",18:"Chest",19:"x-Estonia",20:"Parking",21:"x-Norway",22:"x-Sweden",23:"Clover",24:"x-Finland",25:"x-StationKorea",26:"x-Germany",27:"x-UtilityThree",28:"x-France",29:"x-UK",30:"GotoJail",31:"x-Canada",32:"Clover",33:"x-Mexico",34:"x-USA",35:"x-StationIndia",36:"Chest",37:"x-Qatar",38:"x-UtilityFour",39:"x-China"}
        self.board_deep = {40:"x-Hospital",41:"x-Serbia",42:"x-Croatia",43:"Japan",44:"x-Austria",45:"x-Italy",46:"x-Internet",47:"x-Belgium",48:"Chest",49:"Spain",50:"x-Chile",51:"x-Argentina",52:"x-Power",53:"x-Brazil",54:"Switch",55:"Korea",56:"x-Indonesia",57:"x-Malaysia",58:"x-Water",59:"x-Singapore",60:"Clover",61:"India",62:"Auction",63:"x-Romania"}
        self.non_property_regular = {0,2,7,10,18,20,23,30,32,36}
        self.non_property_deep = {48,54,60,62,43,49,55,61}
        self.house_costs = {"red":200,"orange":180,"yellow":150,"green":100,"blue":100,"pink":150,"brown":60,"dblue":60,"white":60,"purple":80,"aqua":100,"black":130}
        self.house_rents = {1:[5,20,30,90,160,250],3:[10,30,60,180,320,450],6:[10,40,90,270,400,550],8:[10,40,90,270,400,550],9:[15,50,100,300,450,600],11:[15,50,150,450,625,750],12:[15,50,150,450,625,750],14:[20,60,180,500,700,900],16:[20,70,200,550,750,950],17:[20,70,200,550,750,950],19:[30,80,220,600,800,1000],21:[30,90,250,700,875,1050],22:[30,90,250,700,875,1050],24:[40,100,300,750,925,1100],26:[40,110,330,800,975,1150],28:[40,110,330,800,975,1150],29:[50,120,360,850,1025,1200],31:[50,130,390,900,1100,1275],33:[50,150,450,1000,1200,1400],34:[60,150,450,1000,1200,1400],37:[60,175,500,1100,1300,1500],39:[80,200,600,1400,1700,2000],41:[15,50,100,300,450,600],42:[15,50,100,300,450,600],44:[30,80,220,600,800,1000],45:[30,80,220,600,800,1000],47:[30,90,250,700,875,1050],50:[25,70,180,450,650,800],51:[25,70,180,450,650,800],53:[25,75,200,500,700,850],56:[50,120,360,850,1025,1200],57:[50,120,360,850,1025,1200],59:[50,130,390,900,1100,1275],63:[15,50,150,450,625,750]}
        self.mortgage_table = {1:30,3:40,4:100,5:100,6:50,8:50,9:60,11:75,12:75,13:100,14:90,15:100,16:100,17:100,19:110,21:110,22:110,24:120,25:100,26:140,27:100,28:140,29:150,31:150,33:150,34:160,35:100,37:180,38:100,39:200,40:100,41:60,42:60,44:110,45:110,46:100,47:120,50:90,51:90,52:100,53:100,56:150,57:150,58:100,59:160,63:70}
        self.color_sets = {"red":[37,39],"orange":[34,33,31],"pink":[26,28,29],"yellow":[24,22,21],"green":[19,17,16],"blue":[14,12,11],"brown":[6,8,9],"dblue":[1,3],"white":[41,42,63],"aqua":[44,45,47],"purple":[50,51,53],"black":[56,57,59]}
        self.house_numbers = {"red":(2,4,6,8),"dblue":(2,4,6,8),"orange":(3,6,9,12),"yellow":(3,6,9,12),"green":(3,6,9,12),"blue":(3,6,9,12),"pink":(3,6,9,12),"brown":(3,6,9,12),"white":(3,6,9,12),"aqua":(3,6,9,12),"purple":(3,6,9,12),"black":(3,6,9,12)}
        self.hotel_numbers = {"red":10,"dblue":10,"orange":15,"yellow":15,"green":15,"blue":15,"pink":15,"brown":15,"white":15,"aqua":15,"purple":15,"black":15}
        self.color_positions = {"red":[37,39],"dblue":[1,3],"orange":[34,33,31],"yellow":[24,22,21],"green":[19,17,16],"blue":[14,12,11],"pink":[26,28,29],"brown":[6,8,9],"white":[0,4,5],"aqua":[10,13,15],"purple":[20,25,27],"black":[30,35,38]}
        self.unmortgaged_colors = {"p1":"red","p2":"blue","p3":"orange","p4":"green"}
        self.mortgaged_colors = {"p1":"lightpink","p2":"lightblue","p3":"#FFFD01","p4":"lightgreen"}
        self.mortgaged2_colors = {"m1":"lightpink","m2":"lightblue","m3":"#FFFD01","m4":"lightgreen"}
        self.default_board = self.board_regular.copy()
        self.reset_state()
        self.go_enabled = False
        self.go_active = None
        self.go_numbers = {}
        self.go_timer = None
        self.go_lock = threading.Lock()
        self.go_jail_attempts={'p1':0,'p2':0}
        self.turn = 'p1'
        self.override_next_turn = False
        self.go_input_users = users or ['player1bot','player2bot']
        self.num_players = num_players
        self.dice_mode = False
        self.dice_players = None
        self.dice_order = []
        self.expected_player_index = 0
        self.dice_override = False
        self.dice_lock = threading.Lock()
        self.cmd_queue = queue.Queue()
        self.state_lock = threading.Lock()
        self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.worker_thread.start()
        self.msg_queue = queue.Queue()
        self.msg_worker = threading.Thread(target=self._process_msg_queue, daemon=True)    
        self.msg_worker.start()
        self.disabled_dice = set()
        self.up_timer = None
        self.up_timer_lock = threading.Lock()
        self.admin_users = {u.lower() for u in {"juntao", "crinjal"}}

    def on_welcome(self,c,e): c.join(self.channel)
    def any_player_negative(self):
        return any(p["money"] < 0 for p in self.players.values())
    def on_pubmsg(self,c,e): self.handle_channel_message(c,e.source.nick.lower(),e.arguments[0].strip().lower())
    def on_privmsg(self,c,e): self.handle_private_message(c,e.source.nick.lower(),e.arguments[0].strip().lower())
    def handle_private_message(self,c,nick,msg):
        if msg.lower().startswith("!add"):
            return c.privmsg(nick,"!add can only be used in ##rento")
        if r:=self.handle_command(nick,msg): c.privmsg(nick,r)
        self.handle_go_privmsg(c,nick,msg)
    def handle_channel_message(self,c,nick,msg):
        r=self.handle_command(nick,msg)
        if msg.lower().startswith(("!mortgage","!redeem")):
            self.schedule_auto_up()
        if r: 
            if msg.lower().startswith(("!start","!move","!add","!teleport","!addonehouse","!removeonehouse","!remove","!freeloan","!gobonus")):
                self.auto_up()
            c.privmsg(self.channel,r)
        self.handle_go_session_command(c,nick,msg)
        self.override_turn(c,nick,msg)
        self.handle_go_command(c,msg,nick)
        self._handle_dice_pub(c,nick,msg)
        self.handle_gojailkey(c,msg)
    def reset_state(self):
        self.players={}
        self.properties={}
        self.houses={}
        self.mortgaged=set()
        self.aliases={"p1":set(),"p2":set(),"p3":set(),"p4":set()}
        self.current_auction=None
        self.current_trade=None
        self.active_board=getattr(self,'default_board',{}).copy()
        self.non_property=set(getattr(self,'non_property_regular',set()))
        self.max_pos=39
        self.jailed = {}
        self.go_jail_key={'p1':False,'p2':False}
        self.consecutive_doubles={}
        self.dice4_streak={}
        self.switch_required=False
        self.auction_required=False
        self.jail_dice_key = {}
        self.dice_rolls = {}
        self.passgo_bonus = {}
        self.free_loans={}
    def _process_queue(self):
        while True:
            try: self.cmd_queue.get()()
            except Exception as e: print(f"Queue worker error: {e}")
            finally: self.cmd_queue.task_done(); time.sleep(0.1)
    def _process_msg_queue(self):
        while True:
            try: t,m=self.msg_queue.get(); self.connection.privmsg(t,m); time.sleep(0.4)
            except Exception as e: print(f"IRC send error: {e}")
            finally: self.msg_queue.task_done()
    def schedule_auto_up(self,delay=2.0):
        with self.up_timer_lock:
            if self.up_timer and self.up_timer.is_alive(): return
            self.up_timer=threading.Timer(delay,self.auto_up)
            self.up_timer.daemon=True
            self.up_timer.start()
        
    def auto_up(self):
        if not self.players:return
        pos=[];money=[];props=[];houses=[]
        for i in range(1,5):
            p=f"p{i}"
            if p in self.players:
                pos+=[str(self.players[p]["pos"])]
                money+=[str(self.players[p]["money"])]
                props+=[str(sum(o==p for o in self.properties.values()))]
                houses+=[str(sum(self.houses.get(x,0) for x,o in self.properties.items() if o==p))]
            else:
                pos+=["0"];money+=["0"];props+=["0"];houses+=["0"]
        try:
            self.connection.privmsg("player1bot","!mv all "+" ".join(pos))
            self.connection.privmsg("player1bot","!set all "+" ".join(money))
            self.connection.topic(self.channel," ".join(pos+money+props+houses))
        except Exception:
            pass

    def handle_command(self,who,body):
        body = body.strip()
        caller = who.lower()
        if body == "!up":
            if not self.players:
                return "No game in progress."
            self.auto_up()
            return None
        
        if m:=re.match(r"!alias\s+(\w+)\s+(\w+)",body):
            pl,a=m.groups();pl=pl.lower();a=a.lower()
            if not isinstance(self.aliases,dict):self.aliases={"p1":set(),"p2":set(),"p3":set(),"p4":set()}
            if pl not in self.aliases or pl not in self.players:return f"{pl} does not exist or game not started."
            if any(a in s for s in self.aliases.values()):return "Alias already used"
            self.aliases[pl].add(a);return f"Alias '{a}' added for {pl}"

        if m:=re.match(r"!start\s+(\d+)\s*(deep|regular)?",body):
            n,mode=int(m.group(1)), m.group(2) or "regular"
            self.reset_state(); self.num_players=n
            self.players={f"p{i+1}":{"money":1000,"pos":0} for i in range(n)}
            self.active_board=self.board_regular.copy() if mode=="regular" else {**self.board_regular,**self.board_deep}
            self.non_property=set(self.non_property_regular) if mode=="regular" else set(self.non_property_regular)|set(self.non_property_deep)
            self.max_pos=39 if mode=="regular" else 63
            for i in range(n): self.aliases.setdefault(f"p{i+1}",set()).add(f"player{i+1}bot")
            try:
                for cmd in ["!cleardot","!clearall",f"!dotlocation {'1' if mode=='regular' else '2'}"]:
                    self.connection.privmsg("player1bot",cmd)
                self._handle_dicestart(self.connection,n)
            except Exception as e:
                return f"Game started but failed to send initial commands: {e}"
            return f"Game started with {n} players ({mode})"
            
        if m := re.match(r"!move\s+(\w+)\s+(-?\d+)", body):
            pl_token, sp = m.groups(); sp = int(sp)
            pl_key = next((k for k, a in self.aliases.items() if pl_token.lower() in a or pl_token.lower() == k), None)
            if not pl_key or pl_key not in self.players: return f"Player {pl_token} does not exist"
            name, msg = self.move_player(pl_key, sp)
            return f"{pl_key} moved to {self.players[pl_key]['pos']} ({name}). Money: {self.players[pl_key]['money']}{msg}"
        if m := re.match(r"!teleport\s+(\w+)\s+(-?\d+)", body):
            pl_token, pos = m.groups(); pos = int(pos)
            pl_key = next((k for k, a in self.aliases.items() if pl_token.lower() in a or pl_token.lower() == k), None)
            if not pl_key or pl_key not in self.players: return f"Player {pl_token} does not exist"
            self.players[pl_key]["pos"] = pos
            return f"{pl_key} teleported to {pos}"
        if m := re.match(r"!add\s+(\w+)\s+(-?\d+)", body):
            pl_token, amount = m.groups(); amount = int(amount)
            pl_key = next((k for k, a in self.aliases.items() if pl_token.lower() in a or pl_token.lower() == k), None)
            if not pl_key or pl_key not in self.players: return f"Player {pl_token} does not exist"
            self.players[pl_key]["money"] += amount
            return f"{pl_key} balance: {self.players[pl_key]['money']}"
        if m := re.match(r"!switch\s+(\w+)\s+(\w+)", body):
            p1,p2=m.groups()
            k1=next((k for k,a in self.aliases.items() if p1.lower() in a or p1.lower()==k),None)
            k2=next((k for k,a in self.aliases.items() if p2.lower() in a or p2.lower()==k),None)
            if not k1 or not k2: return "Player does not exist"
            if k1 not in self.players or k2 not in self.players: return "One or both players are not in the game"
            self.players[k1]["pos"],self.players[k2]["pos"]=self.players[k2]["pos"],self.players[k1]["pos"]
            if self.switch_required:
                self.switch_required=False
                self.auto_up()
            return f"{k1} and {k2} switched"
        m=re.match(r"!remove\s+(p\d+)",body)
        if m:
            rm=m.group(1)
            if rm not in self.players:return f"{rm} is not in the game"
            del self.players[rm]
            if rm in self.aliases:self.aliases[rm].clear()
            to_del=[pos for pos,owner in self.properties.items() if owner==rm]
            for pos in to_del:
                del self.properties[pos]
                if pos in self.houses:del self.houses[pos]
                if pos in self.mortgaged:self.mortgaged.remove(pos)
                old=self.active_board.get(pos,f"Position {pos}");nm=old.split("-",1)[-1]
                self.active_board[pos]=f"x-{nm}"
            auc=self.current_auction
            if auc and "active_players" in auc and rm in auc["active_players"]:
                auc["active_players"].remove(rm)
                if not auc["active_players"]:
                    self.current_auction=None
                else:
                    if auc.get("current_index",0)>=len(auc["active_players"]):auc["current_index"]=0
                    if len(auc["active_players"])==1:
                        winner=auc["active_players"][0];pos=auc["pos"]
                        pname=self.active_board.get(pos,f"Position {pos}")
                        amt=auc["bids"].get(winner,0)
                        self.properties[pos]=winner;self.players[winner]["money"]-=amt
                        self.current_auction=None
                        return f"{winner} automatically wins {pname} for {amt}"
            return f"{rm} has been removed"

        if m:=re.match(r"!insert\s+(p\d+)\s+(-?\d+)",body):
                pl,amt=m.groups();amt=int(amt);pl=pl.lower()
                if pl in self.players:return f"{pl} already exists"
                self.players[pl]={"money":amt,"pos":0};self.aliases.setdefault(pl,set()).add(f"player{pl[1:]}bot")
                try:self.num_players=max(self.num_players,int(pl[1:]))
                except:pass
                self.jailed[pl]=False;self.auto_up()
                return f"{pl} inserted with ${amt}"
                
        if body.lower()=="!propertylist":
            try:
                self.connection.privmsg("player1bot","!cleardot")
                non_props=self.non_property_regular|self.non_property_deep
                with open("property.txt","w",encoding="utf-8") as f:
                    f.writelines(f"{p}:{self.active_board[p]}\n" for p in sorted(self.active_board) if p not in non_props)
                delay=0
                for pos in sorted(self.active_board):
                    if pos in non_props:continue
                    owner=self.properties.get(pos)
                    if not owner:continue
                    if pos in self.mortgaged:owner=f"m{owner[1]}"
                    color=self.unmortgaged_colors.get(owner) if owner[0]=="p" else self.mortgaged2_colors.get(owner)
                    if not color:continue
                    threading.Timer(delay,lambda p=pos,c=color:self.connection.privmsg("player1bot",f"!dot {p} {c}")).start()
                    delay+=1
                return ""
            except Exception as e:
                return f"Could not process property list: {e}"
     
        if body.lower() == "!housestatus":
            import time
            result_lines=[]
            for color,positions in self.color_positions.items():
                props=self.color_sets[color]
                total=sum(self.houses.get(p,0) for p in props)
                result_lines.append(f"{color}:{total}")
                try:
                    if all(self.houses.get(p,0)>=5 for p in props):
                        self.connection.privmsg("player1bot",f"!hotel {' '.join(map(str,positions))}")
                    elif total>0:
                        self.connection.privmsg("player1bot",f"!house {' '.join(map(str,positions))}")
                    else:
                        self.connection.privmsg("player1bot",f"!unbuilding {' '.join(map(str,positions))}")
                    time.sleep(1)
                except Exception:
                    pass
            return " ".join(result_lines)
        if body.lower()=="!status":
            if not self.players:return "No game in progress."
            lines=[]
            for p,d in self.players.items():
                owned=sorted([x for x,o in self.properties.items() if o==p])
                props=",".join(f"{x}{'(M)' if x in self.mortgaged else ''}{'['+str(self.houses.get(x,0))+']' if self.houses.get(x,0) else ''}"for x in owned)or"None"
                pg=self.passgo_bonus.get(p)
                go=f"|GO:{pg['cap']-pg['used']}/{pg['cap']}" if pg else ""
                loan=self.free_loans.get(p)
                loan_txt=f"|Loan:{loan['owed']}" if loan and loan["owed"]>0 else ""
                line=f"{p}:${d['money']},pos {d['pos']}|Properties:{props}{go}{loan_txt}"
                lines.append(line)
            return"|".join(lines)

        if m:=re.match(r"!gobonus\s+(p\d+)\s+(\d+)\s+(\d+)",body):
            pl,bonus,cap=m.groups();bonus=int(bonus);cap=int(cap)
            if pl not in self.players:return f"{pl} not in game"
            if bonus not in (100,50,25,10):return "GO bonus amount must be 100,50,25,or 10"
            if cap not in (100,200,300,400,500,600,700,800,900):return "GO bonus cap must be 100-900"
            self.passgo_bonus[pl]={"outer":bonus,"inner":bonus,"cap":cap,"used":0}
            return f"{pl} gets +{bonus} GO bonus (cap {cap})"

        if m:=re.match(r"!freeloan\s+(p\d+)\s+(\d+)\s+(\d+)",body):
            pl,amount,cut=m.groups();amount=int(amount);cut=int(cut)
            if pl not in self.players:return f"{pl} is not in the game"
            if amount!=100:return "Freeloan amount must be 100"
            if cut not in (20,25,50,100):return "Freeloan deduction must be 20,25,50,or 100"
            if pl not in self.free_loans:self.free_loans[pl]={"owed":0,"outer":0,"inner":0}
            self.free_loans[pl]["owed"]+=amount;self.free_loans[pl]["outer"]+=cut;self.free_loans[pl]["inner"]+=cut
            self.players[pl]["money"]+=amount
            return f"{pl} received ${amount} free loan. Owes ${self.free_loans[pl]['owed']} (-${self.free_loans[pl]['outer']} outer GO / -${self.free_loans[pl]['inner']} inner GO each pass)"

        m=re.match(r"!auction\s+(\d+)",body)
        if m:
            pos=int(m.group(1));prop=self.active_board.get(pos,f"Position {pos}")
            if self.current_auction:return "Auction already in progress."
            non_props=self.non_property_deep if self.max_pos>39 else self.non_property_regular
            if pos in non_props or pos in self.properties or (hasattr(self,"mortgaged") and pos in self.mortgaged):return f"Cannot auction {prop}."
            self.active_board[pos]=f"x-{prop}"
            self.current_auction={"pos":pos,"bids":{},"last_bidder":None,"bid_timer":None}
            if self.auction_required:self.auction_required=False
            try:self.connection.privmsg("player1bot",f"!d2 Auction started for {prop}")
            except:pass
            return f"Auction started for {prop}. Use !bidadd <amount> or !fold."
        
        m=re.match(r"!bidadd\s+(\d+)",body)
        if m and self.current_auction:
            inc=int(m.group(1));auc=self.current_auction
            player_key=next((k for k,s in self.aliases.items() if caller in s or caller==k),None)
            if not player_key:return f"{caller} is not a recognized player."
            if auc["bids"] and player_key==max(auc["bids"],key=auc["bids"].get):return f"{player_key} already has highest bid."
            new_bid=max(auc["bids"].values(),default=0)+inc
            if self.players[player_key]["money"]<new_bid:return f"Not enough money for this bid ({new_bid})"
            auc["bids"][player_key]=new_bid;auc["last_bidder"]=player_key
            if auc.get("bid_timer"):auc["bid_timer"].cancel()

            def auto_win():
                if not self.current_auction:return
                a=self.current_auction
                if a["last_bidder"]==player_key and a["bids"].get(player_key)==new_bid:
                    winner=player_key;amt=a["bids"].get(winner,0);pos=a["pos"]
                    self.players[winner]["money"]-=amt;self.properties[pos]=winner
                    raw=self.active_board.get(pos,f"Position {pos}")
                    name=raw.split("-",1)[-1] if "-" in raw else raw
                    if name.startswith("x-"):name=name[2:]
                    self.active_board[pos]=f"{winner}-{name}"
                    color=self.unmortgaged_colors.get(winner,"red")
                    try:
                        self.connection.privmsg(self.channel,f"{winner} wins {self.active_board[pos]} for {amt}")
                        self.connection.privmsg("player2bot","!sound sold.mp3")
                        self.connection.privmsg("player1bot",f"!d2 {winner} wins {self.active_board[pos]} for {amt}")
                        self.connection.privmsg("player1bot",f"!dot {pos} {color}")
                        self.connection.privmsg("rentobot","!up")
                    except:pass
                    if a.get("bid_timer"):a["bid_timer"].cancel()
                    self.current_auction=None

            auc["bid_timer"]=threading.Timer(10,auto_win);auc["bid_timer"].daemon=True;auc["bid_timer"].start()
            prop=self.active_board.get(auc["pos"],f"Position {auc['pos']}")
            msg=f"{player_key} is winning with {new_bid} on {prop}"
            try:
                self.connection.privmsg("player2bot","!sound bid.mp3")
                self.connection.privmsg("player1bot",f"!d2 {msg}")
            except:pass
            return msg

        if body.lower()=="!fold" and self.current_auction:
            auc=self.current_auction
            player_key=next((k for k,s in self.aliases.items() if caller in s or caller==k),None)
            if not player_key:return f"{caller} is not a recognized player."
            if player_key not in auc["bids"]:return f"{player_key} has no active bid."
            if player_key==auc.get("last_bidder"):return f"{player_key} is currently highest bidder."
            del auc["bids"][player_key]
            if not auc["bids"]:
                pos=auc["pos"];prop=self.active_board.get(pos,f"Position {pos}")
                if auc.get("bid_timer"):auc["bid_timer"].cancel()
                self.current_auction=None
                return f"Auction ended. No bids for {prop}."
            if len(auc["bids"])==1:
                winner=list(auc["bids"])[0];amt=auc["bids"][winner];pos=auc["pos"]
                self.players[winner]["money"]-=amt;self.properties[pos]=winner
                raw=self.active_board.get(pos,f"Position {pos}")
                name=raw.split("-",1)[-1] if "-" in raw else raw
                if name.startswith("x-"):name=name[2:]
                self.active_board[pos]=f"{winner}-{name}"
                color=self.unmortgaged_colors.get(winner,"red")
                if auc.get("bid_timer"):auc["bid_timer"].cancel()
                try:
                    self.connection.privmsg(self.channel,f"{winner} wins {self.active_board[pos]} for {amt}")
                    self.connection.privmsg("player2bot","!sound sold.mp3")
                    self.connection.privmsg("player1bot",f"!d2 {winner} wins {self.active_board[pos]} for {amt}")
                    self.connection.privmsg("player1bot",f"!dot {pos} {color}")
                    self.connection.privmsg("rentobot","!up")
                except:pass
                self.current_auction=None
                return None
            return f"{player_key} folds."
            
        if body.lower()=="!resetauction":
            if not self.current_auction:return "No auction in progress to reset."
            auc=self.current_auction
            if auc.get("bid_timer"):auc["bid_timer"].cancel()
            pos=auc["pos"];raw=self.active_board.get(pos,"")
            if raw.startswith("x-"):self.active_board[pos]=raw[2:]
            auc["bids"]={};auc["last_bidder"]=None
            return f"Auction for property {pos} has been RESET. Bidding restarted."

        if re.match(r"!mortgage\s+(\d+)", body) or re.match(r"!redeem\s+(\d+)", body):
            def queue_func():
                with self.state_lock:
                    msg = None
                    m = re.match(r"!mortgage\s+(\d+)", body)
                    if m:
                        pos = int(m.group(1))
                        if self.current_auction:
                            msg = "Cannot mortgage during an auction"
                        elif pos not in self.properties:
                            msg = f"Position {pos} is not owned"
                        else:
                            owner = self.properties[pos]
                            caller_player = next((k for k,s in self.aliases.items() if caller in s or caller==k), caller)
                            if caller_player != owner:
                                msg = f"Only the owner ({owner}) can mortgage this property"
                            elif pos in self.mortgaged:
                                msg = f"Property {pos} is already mortgaged"
                            elif self.houses.get(pos,0) > 0:
                                msg = f"Cannot mortgage property {pos} because it has houses"
                            else:
                                val = self.mortgage_table.get(pos,0)
                                if val <= 0:
                                    msg = f"Property {pos} cannot be mortgaged"
                                else:
                                    pen = int(val*0.10)
                                    self.players[owner]['money'] += val - pen
                                    self.mortgaged.add(pos)
                                    old = self.active_board.get(pos, f"Position {pos}")
                                    name = old.split('-',1)[-1] if '-' in old else old
                                    pref = f"m{owner[-1]}" if owner.startswith("p") else f"m-{owner}"
                                    self.active_board[pos] = f"{pref}-{name}"
                                    msg = f"mortgaged {owner} {name} for {val-pen} (10% penalty)"
                                    self.msg_queue.put(("player1bot", f"!d2 {msg}"))
                                    self.msg_queue.put(("player2bot", "!sound mortgage.mp3"))
                                    self.msg_queue.put(("player1bot", f"!dot {pos} {self.mortgaged_colors.get(owner,'black')}"))
                    # Redeem logic
                    m = re.match(r"!redeem\s+(\d+)", body)
                    if m:
                        pos = int(m.group(1))
                        if self.current_auction:
                            msg = "Cannot redeem/unmortgage during an auction"
                        elif pos not in self.properties:
                            msg = f"Position {pos} is not owned."
                        else:
                            owner = self.properties[pos]
                            caller_player = next((k for k,s in self.aliases.items() if caller in s or caller==k), caller)
                            if caller_player != owner:
                                msg = f"Only the owner ({owner}) can redeem this property"
                            elif pos not in self.mortgaged:
                                msg = f"Property {pos} is not mortgaged."
                            else:
                                cost = self.mortgage_table.get(pos,0)
                                if self.players[owner]['money'] < cost:
                                    msg = f"{owner} does not have enough money to unmortgage {pos} ({cost})"
                                else:
                                    self.players[owner]['money'] -= cost
                                    self.mortgaged.remove(pos)
                                    old = self.active_board.get(pos, f"Position {pos}")
                                    name = old.split('-',1)[-1] if '-' in old else old
                                    self.active_board[pos] = f"{owner}-{name}"
                                    msg = f"unmortgaged {owner} {name} for {cost}"
                                    self.msg_queue.put(("player1bot", f"!d2 {msg}"))
                                    self.msg_queue.put(("player2bot", "!sound redeem.mp3"))
                                    self.msg_queue.put(("player1bot", f"!dot {pos} {self.unmortgaged_colors.get(owner,'red')}"))

                    if msg:
                        self.msg_queue.put((self.channel, msg))
            self.cmd_queue.put(queue_func)

        m = re.match(r"!addonehouse\s+(\w+)", body)
        if m:
            if self.current_auction: return "Cannot add houses during an auction"
            color = m.group(1)
            if color not in self.color_sets: return f"Color {color} does not exist"
            props = self.color_sets[color]; owners = [self.properties.get(x) for x in props]
            if None in owners or any(isinstance(o,str) and o.startswith("x-") for o in owners if o):
                missing = [str(x) for x,o in zip(props,owners) if o is None or (isinstance(o,str) and o.startswith("x-"))]
                return f"Cannot add houses: unowned properties in set: {', '.join(missing)}"
            if len(set(owners)) != 1: return f"Cannot add houses: not all properties in {color} set are owned by the same player"
            owner = owners[0]; caller_key = next((k for k,s in self.aliases.items() if caller in s or caller==k), caller)
            if caller_key != owner: return f"Only the owner ({owner}) or their alias can add houses to this set"
            mort = [str(x) for x in props if x in self.mortgaged];
            if mort: return f"Cannot add houses: these properties are mortgaged: {', '.join(mort)}"
            max_h = len(props)*5; curr = sum(self.houses.get(x,0) for x in props)
            if curr + len(props) > max_h: return f"Cannot add houses: {color} set would exceed max ({max_h}) houses"
            cost = self.house_costs.get(color,0) * len(props)
            if self.players[owner]['money'] < cost: return f"{owner} does not have enough money to buy houses ({cost} required)"
            for x in props: self.houses[x] = self.houses.get(x,0) + 1
            self.players[owner]['money'] -= cost
            nums = [str(x) for x in props if self.houses.get(x,0) < 5]
            hotels = [str(x) for x in props if self.houses.get(x,0) == 5]
            if nums: self.connection.privmsg("player1bot", "!house " + " ".join(nums))
            if hotels: self.connection.privmsg("player1bot", "!hotel " + " ".join(hotels))
            sound_file = "build3.mp3" if len(props) == 3 else "build2.mp3"
            self.connection.privmsg("player2bot", f"!sound {sound_file}")
            return f"Added 1 house to each property in {color} set. {owner} charged {cost}"
        m = re.match(r"!removeonehouse\s+(\w+)", body)
        if m:
            if self.current_auction: return "Cannot remove houses during an auction"
            color = m.group(1)
            if color not in self.color_sets: return f"Color {color} does not exist"
            props = self.color_sets[color]; owners = [self.properties.get(x) for x in props]
            if None in owners or any(isinstance(o,str) and o.startswith("x-") for o in owners if o):
                missing = [str(x) for x,o in zip(props,owners) if o is None or (isinstance(o,str) and o.startswith("x-"))]
                return f"Cannot remove houses: unowned properties in set: {', '.join(missing)}"
            if len(set(owners)) != 1: return f"Cannot remove houses: not all properties in {color} set are owned by the same player"
            owner = owners[0]; caller_key = next((k for k,s in self.aliases.items() if caller in s or caller==k), caller)
            if caller_key != owner: return f"Only the owner ({owner}) or their alias can remove houses from this set"
            for x in props:
                if self.houses.get(x,0) <= 0: return f"Cannot remove house: {x} in {color} set already has 0 houses"
            refund = self.house_costs.get(color,0)//2 * len(props)
            for x in props: self.houses[x] = self.houses.get(x,0) - 1
            self.players[owner]['money'] += refund
            nums = [str(x) for x in props if 0 < self.houses.get(x,0) < 5]
            hotels = [str(x) for x in props if self.houses.get(x,0) == 5]
            unbuild = [str(x) for x in props if self.houses.get(x,0) == 0]
            if nums: self.connection.privmsg("player1bot", "!house " + " ".join(nums))
            if hotels: self.connection.privmsg("player1bot", "!hotel " + " ".join(hotels))
            if unbuild: self.connection.privmsg("player1bot", "!unbuilding " + " ".join(unbuild))
            sound_file = "destroy3.mp3" if len(props) == 3 else "destroy2.mp3"
            self.connection.privmsg("player2bot", f"!sound {sound_file}")
            return f"Removed 1 house from each property in {color} set. {owner} refunded {refund}"        
                
        m=re.match(r"!save\s*(\S+)?",body)
        if m:
            fn=m.group(1)or"1.pkl"
            state={"players":self.players,"properties":self.properties,"houses":self.houses,"mortgaged":self.mortgaged,"aliases":self.aliases,"current_auction":self.current_auction,"current_trade":self.current_trade,"active_board":self.active_board,"non_property":self.non_property,"num_players":self.num_players,"max_pos":self.max_pos}
            try:
                with open(fn,"wb")as f:pickle.dump(state,f)
                return f"Game state saved to '{fn}'"
            except Exception as e:return f"Failed to save game: {e}"

        m=re.match(r"!restore\s*(\S+)?",body)
        if m:
            fn=m.group(1)or"1.pkl"
            if not os.path.exists(fn):return f"File '{fn}' not found"
            try:
                with open(fn,"rb")as f:state=pickle.load(f)
                self.players=state["players"];self.properties=state["properties"];self.houses=state["houses"]
                self.mortgaged=state["mortgaged"];self.aliases={k:set(v)for k,v in state["aliases"].items()};self.current_auction=state["current_auction"]
                self.current_trade=state["current_trade"];self.active_board=state["active_board"];self.non_property=state["non_property"]
                self.num_players=state["num_players"];self.max_pos=state["max_pos"]
                self.consecutive_doubles={f"p{i}":0 for i in range(1,self.num_players+1)}
                return f"Game state restored from '{fn}'"
            except Exception as e:return f"Failed to restore game: {e}"

        m=re.match(r"!offer-(p\d+)\s+(.+)",body)
        if m:
            offerer=m.group(1);text=m.group(2).strip()
            if offerer not in self.players:return f"{offerer} is not a valid player."
            caller_player=next((k for k,s in self.aliases.items() if caller in s or caller==k),None)
            if caller in self.admin_users:caller_player=offerer
            if caller_player!=offerer:return f"Only {offerer} or their alias can make this offer."
            if self.current_trade:return "A trade is already active. !accept or !reject it first."
            parts=text.split()
            other=next((p for p in parts if p.startswith("p") and p!=offerer),None)
            if other not in self.players:return f"{other} not in game."
            idx=parts.index(other);left_tokens=parts[:idx];right_tokens=parts[idx+1:]
            def parse_side(tokens):
                props=[];money=0
                for t in tokens:
                    if not t:continue
                    if t.startswith("money:"):
                        try:money+=int(t.split(":",1)[1])
                        except:pass
                    else:
                        for p in t.split(","):
                            if p.strip().isdigit():props.append(int(p.strip()))
                return props,money
            left_props,left_money=parse_side(left_tokens)
            right_props,right_money=parse_side(right_tokens)
            def validate_houses(prop_list):
                for pos in prop_list:
                    if self.houses.get(pos,0)>0:
                        for color,group in self.color_sets.items():
                            if pos in group and not set(group).issubset(set(prop_list)):
                                return f"Property {pos} has houses; must trade entire color set: {group}"
                return None
            err=validate_houses(left_props)
            if err:return err
            err=validate_houses(right_props)
            if err:return err
            for pos in left_props:
                if self.properties.get(pos)!=offerer:return f"{offerer} does not own property {pos}"
            for pos in right_props:
                if self.properties.get(pos)!=other:return f"{other} does not own property {pos}"
            self.current_trade={"offerer":offerer,"other":other,"left_props":left_props,"left_money":left_money,"right_props":right_props,"right_money":right_money}
            return f"Trade offer created: {offerer} offers {left_props} + ${left_money} for {other}'s {right_props} + ${right_money}. {other} must !accept or !reject."

        if body.lower()=="!accept":
            if not self.current_trade:return "No active trade."
            t=self.current_trade
            caller_player=next((k for k,s in self.aliases.items() if caller in s or caller==k),None)
            if caller in self.admin_users:caller_player=t["other"]
            if caller_player!=t["other"]:return f"Only {t['other']} may !accept this trade."
            if self.players[t["offerer"]]["money"]<t["left_money"]:return f"{t['offerer']} does not have enough money."
            if self.players[t["other"]]["money"]<t["right_money"]:return f"{t['other']} does not have enough money."
            self.players[t["offerer"]]["money"]-=t["left_money"];self.players[t["other"]]["money"]+=t["left_money"]
            self.players[t["other"]]["money"]-=t["right_money"];self.players[t["offerer"]]["money"]+=t["right_money"]
            def transfer(props,old,new):
                for pos in props:
                    self.properties[pos]=new
                    raw=self.active_board.get(pos,f"Position {pos}")
                    nm=raw.split("-",1)[-1] if "-" in raw else raw
                    self.active_board[pos]=f"{new}-{nm}"
            transfer(t["left_props"],t["offerer"],t["other"])
            transfer(t["right_props"],t["other"],t["offerer"])
            self.current_trade=None
            return "Trade accepted and completed."

        if body.lower()=="!reject":
            if not self.current_trade:return "No active trade."
            t=self.current_trade
            caller_player=next((k for k,s in self.aliases.items() if caller in s or caller==k),None)
            if caller in self.admin_users:caller_player=t["offerer"]
            if caller_player not in (t["offerer"],t["other"]):return "Only involved players may reject the trade."
            self.current_trade=None
            return "Trade rejected."

    def move_player(self,p,sp):
        def play_rent_sound():self.connection.privmsg("player2bot","!sound rent.mp3")
        old=self.players[p]["pos"];in_reg=old<=39
        new=(old+sp)%40 if in_reg else ((old-40+sp)%24)+40
        if self.jailed.get(p,False) and old==10 and new!=10:
            self.jailed[p]=False;self.go_jail_key[p]=False;self.connection.privmsg(self.channel,f"{p} is now out of jail")
        bonus_data=self.passgo_bonus.get(p);loan=self.free_loans.get(p);loan_msg="";bonus_msg=""
        if in_reg and old+sp>39:
            base=200;extra=0
            if bonus_data:
                rem=bonus_data["cap"]-bonus_data["used"];extra=min(bonus_data["outer"],rem);bonus_data["used"]+=extra
                if extra:bonus_msg=f" | GO bonus +{extra}"
            self.players[p]["money"]+=base+extra
            if loan and loan["owed"]>0:
                pay=min(loan["outer"],loan["owed"]);self.players[p]["money"]-=pay;loan["owed"]-=pay;loan_msg=f" | Loan payment -{pay}"
                if loan["owed"]<=0:self.free_loans.pop(p,None)
        elif not in_reg and old+sp>63:
            base=100;extra=0
            if bonus_data:
                rem=bonus_data["cap"]-bonus_data["used"];extra=min(bonus_data["inner"],rem);bonus_data["used"]+=extra
                if extra:bonus_msg=f" | GO bonus +{extra}"
            self.players[p]["money"]+=base+extra
            if loan and loan["owed"]>0:
                pay=min(loan["inner"],loan["owed"]);self.players[p]["money"]-=pay;loan["owed"]-=pay;loan_msg=f" | Loan payment -{pay}"
                if loan["owed"]<=0:self.free_loans.pop(p,None)
        self.players[p]["pos"]=new;name=self.active_board.get(new,f"Position {new}")
        owner=self.properties.get(new);msg="";fee=0
        def send_msg(m):
            if m:self.connection.privmsg(self.channel,m+bonus_msg+loan_msg);self.connection.privmsg("player1bot",f"!d2 {m}{bonus_msg}{loan_msg}")
        
        rails={5:43,15:49,25:55,35:61,43:5,49:15,55:25,61:35}
        if new in rails:
            if new in (5,15,25,35):
                owner=self.properties.get(new)
                if not owner and str(self.active_board.get(new,"")).startswith("x-") and not self.current_auction:
                    self.current_auction={"pos":new,"bids":{},"last_bidder":None,"bid_timer":None}
                    raw=self.active_board.get(new,"")
                    msg+=f" | Auction automatically started for {raw[2:] if raw.startswith('x-') else raw}. Start bidding"
                elif owner and owner!=p:
                    if new in self.mortgaged:msg+=" | Property is mortgaged, no rent"
                    elif self.jailed.get(owner,False):msg+=" | owner in jail, no rent"
                    else:
                        rc=[x for x in (5,15,25,35) if self.properties.get(x)==owner and x not in self.mortgaged]
                        rent={1:25,2:50,3:100,4:200}.get(len(rc),25)
                        self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f" | {p} pays {rent} to {owner} (railroad)"
            if self.max_pos>39:
                target=rails[new];self.players[p]["pos"]=target;new=target;name=self.active_board.get(new,f"Position {new}")
                msg+=f" | Teleported via railroad to {new}";owner=self.properties.get(new)
                if owner and owner!=p:
                    if new in self.mortgaged:msg+=" | Property is mortgaged, no rent"
                    elif self.jailed.get(owner,False):msg+=" | owner in jail, no rent"
                    else:
                        rc=[x for x in (5,15,25,35) if self.properties.get(x)==owner and x not in self.mortgaged]
                        rent={1:25,2:50,3:100,4:200}.get(len(rc),25)
                        self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f" | {p} pays {rent} to {owner} (railroad after teleport)"

        total_houses=sum(h for pos,h in self.houses.items() if self.properties.get(pos)==p)
        total_props=sum(1 for o in self.properties.values() if o==p)

        if new in (2,18,36,48):
            self.players[p]["money"]+=50;msg+=" +50";self.connection.privmsg("player2bot","!sound bonus.mp3")
        elif new in (7,60):
            fee=total_houses*5+total_props*5;self.players[p]["money"]-=fee;msg+=f" pays {fee}";self.connection.privmsg("player2bot","!sound tax.mp3")
        elif new==23:
            fee=total_houses*5+max(0,int(self.players[p]["money"]*0.05));self.players[p]["money"]-=fee;msg+=f" pays {fee}";self.connection.privmsg("player2bot","!sound tax.mp3")
        elif new==32:
            unmortgaged=sum(1 for pos,o in self.properties.items() if o==p and pos not in self.mortgaged)
            mortgaged=sum(1 for pos,o in self.properties.items() if o==p and pos in self.mortgaged)
            fee=unmortgaged*10+mortgaged*5;self.players[p]["money"]-=fee;msg+=f" pays {fee}";self.connection.privmsg("player2bot","!sound tax.mp3")
        elif new==30:
            self.jailed[p]=True;self.players[p]["pos"]=10;msg+=" goes to jail";self.connection.privmsg("player2bot","!sound jail.mp3")
            send_msg(f"{p} goes to jail{msg}");return "Jail",msg


        if new==54:self.switch_required=True;msg+=" | Must use !switch before next dice roll"
        #if new==62:self.auction_required=True;msg+=" | Auction required before next dice roll"

        if owner and owner!=p:
            if new in self.mortgaged:msg+=" | Property is mortgaged, no rent"
            elif self.jailed.get(owner,False):msg+=" | owner in jail, no rent"
            else:
                if new in (4,13,27,38):
                    group=(4,13,27,38);u=[x for x in group if self.properties.get(x)==owner and x not in self.mortgaged]
                    mult={1:4,2:8,3:16,4:25}.get(len(u),4);rent=abs(sp)*mult
                    self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f" | Utility {sp}*{mult}={rent}"
                elif new in (40,46,52,58):
                    group=(40,46,52,58);u=[x for x in group if self.properties.get(x)==owner and x not in self.mortgaged]
                    mult={1:4,2:8,3:16,4:25}.get(len(u),5);rent=abs(sp)*mult
                    self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f" | Utility {sp}*{mult}={rent}"
                else:
                    hc=self.houses.get(new,0);rents=self.house_rents.get(new,[0]);hc=min(hc,len(rents)-1);rent=rents[hc]
                    for color,props in self.color_sets.items():
                        if new in props:
                            if all(self.properties.get(x)==owner for x in props) and all(self.houses.get(x,0)==0 for x in props):rent*=2
                            break
                    self.players[p]["money"]-=rent;self.players[owner]["money"]+=rent;play_rent_sound();msg+=f" | {p} pays {rent} to {owner}"

        if new not in self.non_property and str(self.active_board.get(new,"")).startswith("x-") and new not in self.properties and not self.current_auction and new not in (43,49,55,61):
            
            self.current_auction={"pos":new,"bids":{},"last_bidder":None,"bid_timer":None}
            raw=self.active_board.get(new,"")
            msg+=f" | Auction automatically started for {raw[2:] if raw.startswith('x-') else raw}."

        send_msg(f"{p} lands on {name}{msg}")
        return name,msg
    # -------- Dice1-4 --------
    def _handle_dice_pub(self, c, nick, msg):
        m = msg.strip().lower()
        if self.current_auction and re.match(r"!dice[0-4]-p\d+", m):
            c.privmsg(self.channel, "Cannot use dice while auction is in progress."); return
        if re.match(r"!dice[0-4]-p\d+", m) and any(p["money"] < 0 for p in self.players.values()):
            c.privmsg(self.channel, "Dice disabled: negative balance."); return
        if x := re.match(r"!dicestart(?:\s+(\d))?", m): self._handle_dicestart(c, x); return
        if m.startswith("!dicestop"): self._handle_dicestop(c); return
        if x := re.match(r"!dicedisable\s+([0-4])", m): self._handle_dicedisable(c, int(x.group(1))); return
        if m.startswith("!diceoverride"): self._handle_diceoverride(c, nick); return
        if x := re.match(r"!dicejailkey\s+(p[1-4])", m): self._handle_dicejailkey(c, x.group(1)); return
        if x := re.match(r"!diceremove\s+p([1-4])", m): self._handle_diceremove(c, int(x.group(1))); return
        for d in ("dice0","dice1","dice2","dice3","dice4"):
            if x := re.match(rf"!{d}-p([1-{self.num_players}])", m):
                self._handle_dice_command(c, d, int(x.group(1)), nick); return
    def _handle_dicestart(self,c,m):
        if isinstance(m,int):
            n=m
        else:
            if not m.group(1):c.privmsg(self.channel,"Usage: !dicestart <2-4>");return
            n=int(m.group(1)); 
        if not 2<=n<=4:c.privmsg(self.channel,"Number of players must be 2-4");return
        with self.dice_lock:
            self.dice_mode=True
            self.dice_players=n
            self.dice_order=list(range(1,n+1))
            self.expected_player_index=0
            self.dice_override=False
            self.disabled_dice.clear()
        c.privmsg(self.channel,f"Dice mode started for {n} players.")
        
    def _handle_dicestop(self,c):
        with self.dice_lock:self.dice_mode=False;self.dice_players=None;self.dice_order=[];self.expected_player_index=0;self.dice_override=False;self.disabled_dice.clear()
        c.privmsg(self.channel,"Dice mode stopped. Dice commands disabled.")
    def _handle_diceoverride(self,c,nick):
        with self.dice_lock:
            if not self.dice_mode:c.privmsg(self.channel,"Dice mode not active.");return
            self.dice_override=True
        c.privmsg(self.channel,f"{nick} activated dice override. Any player may roll next.")
    def _handle_dicedisable(self, c, d):
        with self.dice_lock:
            if not self.dice_mode:c.privmsg(self.channel, "Dice mode not active.");return
            self.disabled_dice.add(f"dice{d}")
        c.privmsg(self.channel, f"dice{d} disabled for this dice session.")
    def _handle_diceremove(self,c,pn):
        with self.dice_lock:
            if not self.dice_mode:c.privmsg(self.channel,"Dice mode not active.");return
            if pn not in self.dice_order:c.privmsg(self.channel,f"Player p{pn} not in order");return
            i=self.dice_order.index(pn);self.dice_order.pop(i)
            if i<=self.expected_player_index and self.expected_player_index>0:self.expected_player_index-=1
            if not self.dice_order:self.dice_mode=False;c.privmsg(self.channel,"All players removed. Dice mode stopped.");return
        c.privmsg(self.channel,f"Player p{pn} removed. Order: {self.dice_order}")
    def _handle_dice_command(self,c,d,p,nick):
        pl_key=f"p{p}"
        if self.switch_required:
            c.privmsg(self.channel,"!switch is required before next dice roll.");return
        if self.auction_required:
            c.privmsg(self.channel,"!auction is required before next dice roll.");return  
        with self.dice_lock:
            if not self.dice_mode: c.privmsg(self.channel,"Dice commands disabled. Use !dicestart <number of players>"); return
            if d in self.disabled_dice: c.privmsg(self.channel, f"{d} is currently disabled."); return
            if p not in self.dice_order: c.privmsg(self.channel,f"Player p{p} not active."); return
            exp=self.dice_order[self.expected_player_index]
            if not(self.dice_override or p==exp): c.privmsg(self.channel,f"Not your turn. Next: p{exp}. Use !diceoverride to allow."); return
            if self.dice_override: self.dice_override=False; self.expected_player_index=self.dice_order.index(p)
            if self.jailed.get(pl_key, False) and self.jail_dice_key.get(pl_key, False) and d == "dice4":
                c.privmsg(self.channel, f"{pl_key} used !dicejailkey - dice4 is not allowed."); return
            if d=="dice4":
                if not self.jailed.get(pl_key, False): c.privmsg(self.channel,"!dice4 cannot be used. This player is not in jail."); return
            elif d in ("dice0","dice1","dice2","dice3"):
                if self.jailed.get(pl_key, False):
                    if not self.jail_dice_key.get(pl_key, False): c.privmsg(self.channel,f"{pl_key} is in jail! Use !dicejailkey {pl_key} to roll {d}."); return
                    else: self.jail_dice_key[pl_key]=False
            if d=="dice4":self.dice4_streak[pl_key]=self.dice4_streak.get(pl_key,0)+1
            else:self.dice4_streak[pl_key]=0
        getattr(self,f"_handle_{d}",lambda*a:None)(c,p)
        if d == "dice4" and self.dice4_streak.get(pl_key, 0) >= 3:
            self.dice4_streak[pl_key] = 0
            c.privmsg(self.channel, f"{pl_key} rolled dice4 three times in a row! Auto jail key used.")
            self._handle_dicejailkey(c, pl_key)
        with self.dice_lock:
            r=self.dice_rolls.get(p)
            if r and r[0]!=r[1]: self.expected_player_index=(self.expected_player_index+1)%len(self.dice_order)
    def _handle_dicejailkey(self, c, pl_key):
        pl_key = pl_key.lower()
        if pl_key not in self.jailed:
            c.privmsg(self.channel, f"{pl_key} is not a valid player."); return
        with self.dice_lock:
            if not self.jailed[pl_key]:
                c.privmsg(self.channel, f"{pl_key} is not in jail. !dicejailkey not needed."); return
            self.jail_dice_key[pl_key] = True
        c.privmsg(self.channel, f"{pl_key} activated !dicejailkey. Next dice0-3 roll in jail is allowed.")
        try: c.privmsg("player2bot", "!sound key.mp3")
        except: pass
    def _handle_dice0(self,c,p):self._roll_and_handle(c,p,[1,2,3,4,5,6],[1,2,3,4,5,6],"dice0",True)
    def _handle_dice1(self,c,p):self._roll_and_handle(c,p,[1,1,2,2,3,3],[1,1,2,2,3,3],"dice1",True)
    def _handle_dice2(self,c,p):self._roll_and_handle(c,p,[1,1,2,2,3,3],[4,4,5,5,6,6],"dice2",True)
    def _handle_dice3(self,c,p):self._roll_and_handle(c,p,[4,4,5,5,6,6],[4,4,5,5,6,6],"dice3",True)
    def _handle_dice4(self,c,p):self._roll_and_handle(c,p,[1,2,3,4,5,6],[1,2,3,4,5,6],"dice4",False)
    def _roll_and_handle(self, c, p, p1, p2, d, nl=True):
        f,s=random.choice(p1),random.choice(p2);t=f+s;pl=f"p{p}";dbl=f==s
        self.dice_rolls[p]=(f,s);self.consecutive_doubles[pl]=self.consecutive_doubles.get(pl,0)+1 if dbl else 0
        c.privmsg(self.channel,f"{d} rolled by {pl} {f}+{s}")
        if self.consecutive_doubles[pl]>=CONSECUTIVE_DOUBLES_FOR_TELEPORT:
            self.consecutive_doubles[pl]=0;c.privmsg(self.channel,f"{pl} rolled doubles twice. Turn lost")
            try:self.handle_command("dicebot",f"!teleport {pl} 10");c.privmsg("##rento",f"{pl} was teleported to position 10 jail");self.jailed[pl]=True
            except: pass
            try: c.privmsg("player2bot", "!sound jail.mp3")
            except: pass
            threading.Timer(0.1,lambda:c.privmsg("player1bot",f'!d1 "{pl} turn ended"')).start()
            threading.Timer(0.2,lambda:self.handle_command("dicebot","!up")).start()
            with self.dice_lock:
                if self.dice_mode and self.dice_order:self.expected_player_index=(self.expected_player_index+1)%len(self.dice_order)
            try: c.privmsg("player2bot", "!sound click.mp3")   
            except: pass
            return
        if nl or dbl:
            try: c.privmsg("player2bot", "!sound click.mp3")
            except: pass
            try: self.handle_command("dicebot",f"!move {pl} {t}")
            except: pass
            threading.Timer(0.1,lambda:c.privmsg("player1bot",f'!d1 "Double for {(pl)}: Go Again"' if dbl else f'!d1 "{pl} turn ended"')).start()
            threading.Timer(0.2,lambda:self.handle_command("dicebot","!up")).start()
        else:
            threading.Timer(0.3,lambda:c.privmsg("player1bot",f'!d1 "{pl} turn ended"')).start()
            try: c.privmsg("player2bot", "!sound click.mp3")
            except: pass
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
                c.privmsg(self.channel,f"{nick} used GO override! !go{self.go_active} stopped")
                if self.go_timer:self.go_timer.cancel();self.go_timer=None
                self.go_active=None;self.go_numbers={};self.go_owner=None
                if self.go_lock.locked():self.go_lock.release()
            self.override_next_turn=True
            c.privmsg(self.channel,f"{nick} used GO override! Next turn open")
    def handle_go_command(self,c,msg,nick):
        m=re.match(r"!go([1-4])(?:\s+(\d+))?",msg)
        if not m:return
        if self.players and self.any_player_negative():c.privmsg(self.channel,"GO disabled: negative balance.");return
        if not self.go_enabled:c.privmsg(self.channel,f"{nick}, use !gostart first");return
        cmd=m.group(1)
        if nick in self.aliases.get('p1',[]) or nick=='p1':p='p1'
        elif nick in self.aliases.get('p2',[]) or nick=='p2':p='p2'
        else:c.privmsg(self.channel,f"{nick}, not allowed");return
        if (p=='p1' and cmd not in ('1','3')) or (p=='p2' and cmd not in ('2','4')):
            c.privmsg(self.channel,f"{nick}, wrong GO command");return
        jail=self.jailed.get(p,False); key=self.go_jail_key.get(p,False)
        if cmd in ('1','2') and jail and not key:        
            c.privmsg(self.channel,f"{nick}, use !gojailkey {p} first");return
        if cmd in ('3','4') and (not jail or key):
            c.privmsg(self.channel,f"!go{cmd} jailkeyused use go1 or go2");return
        if not self.override_next_turn and self.turn!=p:
            c.privmsg(self.channel,f"{nick}, not your turn. Use !gooverride");return
        self.override_next_turn=False;self.go_owner=p;self.start_go(c,m)
    def handle_gojailkey(self,c,msg):
        m=re.match(r"!gojailkey\s+(p[1-2])",msg.lower())
        if not m:return
        p=m.group(1)
        if not self.jailed.get(p,False):c.privmsg(self.channel,f"{p} is not in jail.");return
        self.go_jail_key[p]=True
        self.go_jail_attempts[p]=0
        c.privmsg(self.channel,f"{p} !gojailkey activated")
        try:c.privmsg("player2bot","!sound key.mp3")
        except:pass
    def handle_go_privmsg(self,c,user,msg):
        if not self.go_active or user not in self.go_input_users:return
        if not msg.isdigit() or not 0<=int(msg)<=7:c.privmsg(user,"number must be 0-7");return
        self.go_numbers[user]=int(msg)
        c.privmsg(user,f"number {msg} received for !go{self.go_active}")
        if user.lower() in ("player1bot","player2bot"):
            try:c.privmsg("player2bot",f"!sound {'click.mp3' if user.lower()=='player1bot' else 'dice.mp3'}")
            except:pass
        if len(self.go_numbers)==len(self.go_input_users):self.end_go(c,"completed")
    def start_go(self,c,m):
        if not self.go_lock.acquire(blocking=False):c.privmsg(self.channel,"Another GO is active");return
        self.go_active=m.group(1);self.go_numbers={}
        t=int(m.group(2)) if m.group(2) else 60
        c.privmsg(self.channel,f"!go{self.go_active} started. Waiting for numbers. Timeout: {t}s")
        if self.go_timer:self.go_timer.cancel()
        self.go_timer=threading.Timer(t,self.timeout,[c]);self.go_timer.start()
    def timeout(self,c):
        x=[u for u in self.go_input_users if u not in self.go_numbers]
        if x:c.privmsg(self.channel,f"!go{self.go_active} timed out. Missing: {', '.join(x)}")
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
                    self.go_jail_key[p]=True
                    self.go_jail_attempts[p]=0
                    c.privmsg(self.channel,f"{p} automatically activated !gojailkey")
                    try:c.privmsg("player2bot","!sound key.mp3")
                    except:pass
            else:
                self.go_jail_attempts[p]=0
            if jail and not double:
                c.privmsg(self.channel,f"!go{self.go_active} requires doubles. Dice: {nums[0]} and {nums[1]}")
                self.turn='p2' if p=='p1' else 'p1'
                c.privmsg(self.channel,f"Turn switched to {self.turn}")
            else:
                self.handle_command("dicebot",f"!move {p} {total}")
                c.privmsg(self.channel,f"Dice results: {nums[0]} and {nums[1]}")
                pm={
                    True:{
                        '1': '!d1 "Double for (P1): press go again"',
                        '2': '!d1 "Double for (P2): press go again"',
                        '3': '!d1 "Double for (P1): press go again"',
                        '4': '!d1 "Double for (P2): press go again"',
                    },
                    False:{
                        '1': '!d1 "Now Player - 2 - Turn"',
                        '2': '!d1 "Now Player - 1 - Turn"',
                        '3': '!d1 "Now Player - 2 - Turn"',
                        '4': '!d1 "Now Player - 1 - Turn"',
                    },
                }[double][self.go_active]
                c.privmsg("player1bot",pm)
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
    MonopolyBot("##rento","rentobot","irc.ipv6.libera.chat",6667).start()
