from setuptools import setup, find_packages

setup(
    name="hardbrake",
    version="0.0.5",
    author="Tahsin",
    author_email="hello@tahsin.us",
    description="A wrapper around HandBrake CLI for encoding multiple files with ease.",
    packages=find_packages(),
    install_requires=[
        "autopep8==2.0.1",
        "markdown-it-py==2.1.0",
        "mdurl==0.1.2",
        "prompt-toolkit==3.0.36",
        "pycodestyle==2.10.0",
        "pyee==9.0.4",
        "Pygments==2.14.0",
        "ranger-fm==1.9.3",
        "rich==13.3.1",
        "tomli==2.0.1",
        "typing_extensions==4.5.0",
        "wcwidth==0.2.6",
    ],
    entry_points={
        'console_scripts': [
            'hardbrake = src.app:main'
        ]
    }
)
