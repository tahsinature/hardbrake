import prompt_toolkit as pt
from prompt_toolkit.shortcuts.prompt import CompleteStyle
from prompt_toolkit.completion import WordCompleter
import questionary


def multi_select(msg: str = "Select an option", choices: list[str] = []):
  value = pt.prompt(
      msg,
      completer=WordCompleter(choices, ignore_case=True),
      complete_while_typing=True,
  )

  return value.strip()


def ask_autocomplete(choices: list[str], question: str = "Select an option", ):

  return questionary.autocomplete(
      question,
      complete_style=CompleteStyle.MULTI_COLUMN,
      choices=choices,
  ).ask()


def ask_boolean(question: str = "Select an option", ):
  return questionary.confirm(
      question,
  ).ask()


def ask_multiselect(choices: list[str], question: str = "Select an option", ):
  return questionary.checkbox(
      question,
      choices=choices,
  ).ask()


if __name__ == "__main__":
  pass

  # print(ask_boolean("Are you happy with the encoding?"))
  #   ask_autocomplete(["a", "b", "c"], "Select an option")
