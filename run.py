import click
from src import app


@click.command()
@click.option('--test', is_flag=True, help='Run testing function', default=False, )
def exec(test: str):
  if test:
    app.test()
  else:
    app.main()


exec()
