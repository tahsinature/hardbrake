import prompt_toolkit as pt
from prompt_toolkit.completion import WordCompleter


# answer = pt.prompt("Select a preset: ")

  return questionary.autocomplete(
      question,
      complete_style=CompleteStyle.MULTI_COLUMN,
      choices=choices,
  ).ask()

def multi_select(msg: str = "Select an option", choices: list[str] = []):
    value = pt.prompt(
        msg,
        completer=WordCompleter(choices, ignore_case=True),
        complete_while_typing=True,
    )

    return value.strip()
