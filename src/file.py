import subprocess
import os


current_dir = os.path.dirname(os.path.realpath(__file__))
output_path = os.path.join(current_dir, "OUTFILE")

cmd = f"ranger --choosefiles={output_path}"


def select_files():
    subprocess.run(cmd, shell=True)

    allowed_extensions = ["mp4", "mkv", "avi", "mov", "m4v", "flv", "wmv"]

    with open(output_path, "r") as f:
        data = f.read()
        filtered_data = map(lambda x: x.strip(), data.splitlines())
        filtered_data = list(filter(lambda x: len(x) > 0, filtered_data))
        filtered_data = list(filter(lambda x: x.split(
            ".")[-1] in allowed_extensions, filtered_data))

    os.remove(output_path)

    return filtered_data
