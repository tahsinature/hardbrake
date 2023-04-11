from setuptools import setup, find_packages


with open("requirements.txt", "r") as f:
  required_packages = f.read().splitlines()


setup(
    name="hardbrake",
    version="0.0.5",
    author="Tahsin",
    author_email="hello@tahsin.us",
    description="A wrapper around HandBrake CLI for encoding multiple files with ease.",
    packages=find_packages(),
    install_requires=required_packages,
    data_files=[("", ["requirements.txt"])],
    entry_points={
        'console_scripts': [
            'hardbrake = src.app:cli',
            'hb = src.app:cli'
        ]
    }
)
