apt update \
    && apt install -y make twine \
    && make prepare \
    && make build \
    && twine upload dist/*