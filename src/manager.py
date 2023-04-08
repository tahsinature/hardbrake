import src.event as event
import src.loader as loader
import src.utils as utils
from rich import print
from rich.panel import Panel
from rich.syntax import Syntax


def manage(cmds: list[str]):
  loader.loader.start()

  def handle_progress(cmd: str, percent: int):
    loader.loader.update(utils.hash(cmd), percent)

  def get_process(cmd: str):
    return event.ProcessWithEvent(cmd, progress_cb=handle_progress)

  pwe_list = list(map(get_process, cmds))

  for pwe in pwe_list:
    loader.loader.add_task(utils.hash(pwe.cmd), 100)

  for pwe in pwe_list:
    syntax = Syntax(pwe.cmd, "bash", theme="monokai", word_wrap=True)
    panel = Panel(syntax, title="Command", )

    print(panel)
    pwe.start()

  loader.loader.stop()


def main():

  cmd1 = "source /Users/tahsin/.commonrc && hb_test 10"
  cmd2 = "source /Users/tahsin/.commonrc && hb_test 12"
  cmd3 = "source /Users/tahsin/.commonrc && hb_test 5"
  cmd4 = "ls"

  cmds = [cmd1, cmd2, cmd3, cmd4]

  manage(cmds)


if __name__ == "__main__":
  main()
