start:
	python3 src/app.py

venv:
	python3 -m venv venv

install:
	source venv/bin/activate;
	pip install -r requirements.txt;

clean:
	rm -rf venv

check:
	which python3