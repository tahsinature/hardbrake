from rich import print


def error(msg: str):
  print(f"[bold red]Error[/bold red]: {msg}")


def success(msg: str):
  print(f"[bold green]Success[/bold green]: {msg}")
