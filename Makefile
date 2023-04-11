start:
	python3 run.py

test:
	python3 run.py --test

prepare:
	python3 -m venv venv;
	source venv/bin/activate;
	which python3;
	pip install --upgrade pip;
	pip install -r requirements.txt;
	pip install -r requirements-dev.txt;

clean:
	rm -rf venv

build:
	which python3;
	rm -rf dist;
	python3 setup.py sdist;