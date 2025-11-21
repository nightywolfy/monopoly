import re
import threading
import random
import subprocess
import queue
from irc.bot import SingleServerIRCBot
from irc.connection import Factory
import shutil
import os
import time

# --- Mapping of board numbers to coordinates ---
coordinates = {
    1:  "1225,1140 1235,1150",
    3:  "990,1140 1000,1150",
    4:  "870,1136 880,1146",
    5:  "745,1136 755,1146",
    6:  "620,1140 630,1150",
    8:  "380,1140 390,1150",
    9:  "260,1140 270,1150",
    11: "212,1094 222,1104",
    12: "213,985 223,995",
    13: "217,872 227,882",
    14: "220,760 230,770",
    15: "223,647 233,657",
    16: "226,534 236,544",
    17: "229,430 239,440",
    19: "233,225 243,235",
    21: "290,192 300,202",
    22: "400,192 410,202",
    24: "625,192 635,202",
    25: "745,192 755,202",
    26: "860,192 870,202",
    27: "973,192 983,202",
    28: "1090,193 1100,203",
    29: "1205,193 1215,203",
    31: "1245,225 1255,235",
    33: "1250,430 1260,440",
    34: "1255,535 1265,545",
    35: "1260,645 1270,655",
    37: "1267,865 1277,875",
    38: "1273,985 1283,995",
    39: "1275,1095 1285,1105"
}

# --- Color mapping ---
unmortgaged_colors = {"p1": "red", "p2": "blue", "p3": "orange", "p4": "purple"}
mortgaged_colors = {"p1": "black", "p2": "grey", "p3": "white", "p4": "lightpink"}

# --------------------------------------------------------------
#                     MonopolyBot Class
# --------------------------------------------------------------

class MonopolyBot(SingleServerIRCBot):
    def __init__(self, channel, nickname, server, port, num_players=4):
        factory = Factory(ipv6=True)
        super().__init__([(server, port)], nickname, nickname, connect_factory=factory)

        self.channel = channel.lower()
        self._nickname = nickname
        self._server = server
        self._port = port
        self._factory = factory

        # --- Reconnect control ---
        self.reconnect_active = False

        # --- ImageMagick queue ---
        self.mogrify_queue = queue.Queue()
        self.mogrify_thread = threading.Thread(target=self.process_queue, daemon=True)
        self.mogrify_thread.start()

        # --- GO command state ---
        self.go_lock = threading.Lock()
        self.go_active = None
        self.go_timeout = 60
        self.go_numbers = {}
        self.go_timer = None
        self.go_users = [f'player{i}bot' for i in range(1, num_players+1)]
        self.go_input_users = ['player1bot', 'player2bot']  # only these users send numbers

        # --- Dice ---
        self.num_players = num_players
        self.dice_rolls = {}

    # ----------------------------------------------------------
    #                 IRC EVENTS & RECONNECT
    # ----------------------------------------------------------

    def on_disconnect(self, connection, event):
        if self.reconnect_active:
            print("[Reconnect] Already reconnecting, skipping.")
            return
        self.reconnect_active = True
        print("[IRC] Disconnected. Starting reconnect loop…")
        threading.Thread(target=self._reconnect_loop, daemon=True).start()

    def _reconnect_loop(self, base_wait=60):
        """
        Reconnect with configured nick only.
        Retry forever until successful.
        """
        attempt = 1
        while True:
            # Check if already connected
            if self.connection and self.connection.is_connected():
                print("[Reconnect] Already connected. Exiting reconnect loop.")
                self.reconnect_active = False
                return

            wait_time = min(base_wait * attempt, 300)  # cap wait to 5 minutes
            try:
                print(f"[Reconnect] Attempt {attempt}: connecting with nick '{self._nickname}'")

                # Create entirely new connection
                self.connection = self.reactor.server().connect(
                    self._nickname,
                    self._nickname,
                    connect_factory=self._factory
                )

                print("[Reconnect] Connected. Joining channel…")
                self.connection.join(self.channel)
                self.reconnect_active = False
                return

            except Exception as e:
                print(f"[Reconnect] Failed: {e}. Retrying in {wait_time}s…")
                time.sleep(wait_time)
                attempt += 1

    def on_welcome(self, connection, event):
        connection.join(self.channel)

    def on_pubmsg(self, connection, event):
        message = event.arguments[0].strip().lower()

        # --- !go command ---
        m = re.match(r"!go([1-4])(?:\s+(\d+))?", message)
        if m:
            self.handle_go_command(connection, m)
            return

        # --- !stopgo command ---
        if message.startswith("!stopgo"):
            self.handle_stopgo(connection)
            return

        # --- !freshmap command ---
        if message.startswith("!freshmap"):
            try:
                temp_path = "map_temp.webp"
                shutil.copyfile("cb2.webp", temp_path)
                self.mogrify_queue.put(("REPLACE_MAP", temp_path))
                connection.privmsg(self.channel, "Fresh map queued from cb2.webp.")
            except Exception as e:
                connection.privmsg(self.channel, f"Error queuing fresh map: {e}")
            return

        # --- !dice commands ---
        dice_commands = ['dice1', 'dice2', 'dice3', 'dice4']
        for dice_name in dice_commands:
            m = re.match(rf"!{dice_name}-p([1-{self.num_players}])", message)
            if m:
                player_num = int(m.group(1))
                getattr(self, f"handle_{dice_name}")(connection, player_num)
                return

        # --- ImageMagick update commands ---
        msg_split = message.split()
        if len(msg_split) < 4:
            return

        first_word = msg_split[0]
        player = msg_split[1]
        try:
            number = int(msg_split[3])
        except ValueError:
            return

        if first_word not in ("auction-folded", "unmortgaged", "mortgaged"):
            return
        if number not in coordinates:
            return

        coord = coordinates[number]
        if first_word in ("auction-folded", "unmortgaged"):
            color = unmortgaged_colors.get(player, "red")
        else:
            color = mortgaged_colors.get(player, "red")

        self.mogrify_queue.put((coord, color))

    def on_privmsg(self, connection, event):
        sender = event.source.nick.lower()
        message = event.arguments[0].strip().lower()
        if self.go_active and sender in self.go_input_users:
            if message.isdigit():
                num = int(message)
                if 0 <= num <= 7:
                    self.go_numbers[sender] = num
                    connection.privmsg(sender, f"number {num} received for !go{self.go_active}.")
                    if len(self.go_numbers) == len(self.go_input_users):
                        self._go_complete()
                else:
                    connection.privmsg(sender, "number must be 0-7.")
            else:
                connection.privmsg(sender, "send a number 0-7.")

    # ----------------------------------------------------------
    #                      DICE HELPERS
    # ----------------------------------------------------------

    def roll_dice(self, connection, player_num, pool1, pool2, dice_name):
        if 1 <= player_num <= self.num_players:
            first = random.choice(pool1)
            second = random.choice(pool2)
            self.dice_rolls[player_num] = (first, second)
            connection.privmsg(self.channel, f"{dice_name} rolled by p{player_num} {first} + {second}")
        else:
            connection.privmsg(self.channel, f"Invalid player number. Must be 1-{self.num_players}.")

    def handle_dice1(self, connection, player_num):
        pool = [1,1,2,2,3,3]
        self.roll_dice(connection, player_num, pool, pool, "dice1")

    def handle_dice2(self, connection, player_num):
        pool1 = [1,1,2,2,3,3]
        pool2 = [4,4,5,5,6,6]
        self.roll_dice(connection, player_num, pool1, pool2, "dice2")

    def handle_dice3(self, connection, player_num):
        pool = [4,4,5,5,6,6]
        self.roll_dice(connection, player_num, pool, pool, "dice3")

    def handle_dice4(self, connection, player_num):
        pool = [1,2,3,4,5,6]
        self.roll_dice(connection, player_num, pool, pool, "dice4")

    # ----------------------------------------------------------
    #                      GO COMMANDS
    # ----------------------------------------------------------

    def handle_go_command(self, connection, match):
        go_num = match.group(1)
        timeout_str = match.group(2)
        try:
            timeout = int(timeout_str) if timeout_str else 60
        except ValueError:
            timeout = 60

        if not self.go_lock.acquire(blocking=False):
            connection.privmsg(self.channel, f"cannot start !go{go_num}, another go command is active.")
            return

        self.go_active = go_num
        self.go_timeout = timeout
        self.go_numbers = {}
        connection.privmsg(self.channel, f"!go{go_num} started. Waiting for numbers from {', '.join(self.go_input_users)}. Timeout: {self.go_timeout}s")

        if self.go_timer:
            self.go_timer.cancel()
        self.go_timer = threading.Timer(self.go_timeout, self._go_timeout)
        self.go_timer.start()

    def handle_stopgo(self, connection):
        if not self.go_active:
            connection.privmsg(self.channel, "No active !go command to stop.")
            return

        if self.go_timer:
            self.go_timer.cancel()
            self.go_timer = None

        connection.privmsg(self.channel, f"!go{self.go_active} stopped manually.")
        self._reset_go_state()

    def _go_timeout(self):
        try:
            missing = [u for u in self.go_input_users if u not in self.go_numbers]
            if missing:
                msg = f"!go{self.go_active} timed out. Missing numbers from: {', '.join(missing)}"
            else:
                msg = f"!go{self.go_active} timed out."
            self.connection.privmsg(self.channel, msg)
        finally:
            self._reset_go_state()

    def _go_complete(self):
        try:
            nums = [self.go_numbers.get(u, 0) for u in self.go_input_users]
            msg = f"go{self.go_active} resulted in {' + '.join(map(str, nums))}"
            self.connection.privmsg(self.channel, msg)
        finally:
            self._reset_go_state()

    def _reset_go_state(self):
        self.go_active = None
        self.go_numbers = {}
        if self.go_timer:
            self.go_timer.cancel()
            self.go_timer = None
        if self.go_lock.locked():
            self.go_lock.release()

    # ----------------------------------------------------------
    #                  ImageMagick Queue
    # ----------------------------------------------------------

    def process_queue(self):
        path = "map.webp"
        while True:
            coord, color = self.mogrify_queue.get()
            try:
                if coord == "REPLACE_MAP":
                    shutil.move(color, path)
                else:
                    subprocess.run(
                        f'mogrify -fill {color} -stroke black -strokewidth 3 -draw "circle {coord}" "{path}"',
                        shell=True
                    )
                    # Avoid crash if disconnected
                    if self.connection and self.connection.is_connected():
                        self.connection.privmsg("rentobot", "!up")
            except Exception as e:
                print(f"Error processing ImageMagick queue: {e}")
            finally:
                self.mogrify_queue.task_done()



if __name__ == "__main__":
    bot = MonopolyBot(
        channel="##rento",
        nickname="diceman",
        server="irc.ipv6.libera.chat",
        port=6667,
        num_players=4
    )
    bot.start()
