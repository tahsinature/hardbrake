from rich.progress import Progress, TaskID


class Loader:
  progress = Progress()
  started = False
  tasks: dict[str, TaskID] = {}

  def add_task(self, task_id: str, total: int):
    self.tasks[task_id] = self.progress.add_task(task_id, total=total)

  def start(self):
    if self.started:
      raise Exception("Loader already started")

    self.started = True
    self.progress.start()

  def update(self, task_id: str, progress: int):
    self.check_if_started()
    self.progress.update(self.tasks[task_id], completed=progress)

  def check_if_started(self):
    if not self.started:
      raise Exception("Loader not started")

  def stop(self):
    self.check_if_started()
    self.progress.stop()
    self.progress.__exit__(None, None, None)


loader = Loader()


def main():
  loader = Loader()

  loader.progress.update(loader.tasks["A"], completed=20)

  loader.progress.stop()


if __name__ == "__main__":
  main()
