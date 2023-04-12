start:
	python3 run.py

test:
	python3 run.py --test

prepare:
	pip install --upgrade pip;
	pip install -r requirements.txt;
	pip install -r requirements-dev.txt;

build:
	which python3;
	rm -rf dist;
	python3 setup.py sdist;