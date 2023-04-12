from setuptools import setup, find_packages
import version


with open("requirements.txt", "r") as f:
  required_packages = f.read().splitlines()


setup(
    name="hardbrake",
    version=version.current,
    author="Tahsin",
    author_email="hello@tahsin.us",
    description="A wrapper around HandBrake CLI for encoding multiple files with ease.",
    packages=find_packages(),
    install_requires=required_packages,
    data_files=[("", ["requirements.txt"])],
    entry_points={
        'console_scripts': [
            'hardbrake = run:exec',
            'hb = run:exec'
        ]
    }
)
