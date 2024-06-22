import src.event as event
import src.loader as loader
import src.utils as utils
from rich import print
from rich.panel import Panel
from rich.syntax import Syntax
import time


def manage(cmds: list[str]):
    loader.loader.start()

    all_task_name = f"all ({len(cmds)})"

    loader.loader.add_task(all_task_name, len(cmds))
    loader.loader.add_task("current", 100)

    def handle_progress(cmd: str, percent: int):
        loader.loader.update("current", percent)

    for i in range(len(cmds)):
        loader.loader.update("current", 0)
        cmd = cmds[i]
        time.sleep(0.01)
        p = event.ProcessWithEvent(cmd, progress_cb=handle_progress)
        p.start()

        loader.loader.update(all_task_name, i + 1)

    loader.loader.stop()


def main():

    cmds = []

    for i in range(1000):
        cmds.append("ls")

    manage(cmds)


if __name__ == "__main__":
    main()
