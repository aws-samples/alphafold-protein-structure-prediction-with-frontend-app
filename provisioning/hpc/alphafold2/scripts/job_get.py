import datetime
import json
import subprocess
import sys

args = sys.argv
output = {"id": "", "start": "", "end": "", "status": "", "error": ""}
stderr = ""

# Job ID が渡されたかチェック
if len(args) != 2:
    stderr += "Error: there's no job id input"
    output["error"] = stderr
    print(json.dumps(output))

else:
    list_job_command = " ".join(["sacct -j", args[1], "-o JobID,Start,End,State -X"])
    list_output = subprocess.run(
        [list_job_command], shell=True, capture_output=True, text=True
    )

    if list_output.returncode != 0:
        stderr += "CPU search job is finished with some errors: " + list_output.stderr
        output["error"] = stderr
        print(json.dumps(output))

    else:
        number_of_jobs = len(list_output.stdout.rstrip().split("\n"))

        # 最初の 2 行はヘッダ
        if number_of_jobs <= 2:
            stderr += "There's no jobs to display"
            output["error"] = stderr
            print(json.dumps(output))

        else:
            record = list_output.stdout.rstrip().split("\n")[2].split()

            # JST に変換
            start_time_JST = datetime.datetime.fromisoformat(record[1]).astimezone(
                datetime.timezone(datetime.timedelta(hours=+9))
            )
            record[1] = int(start_time_JST.timestamp())

            # Status によっては endtime が "Unknown" になる
            if record[2] != "Unknown":
                end_time_JST = datetime.datetime.fromisoformat(record[2]).astimezone(
                    datetime.timezone(datetime.timedelta(hours=+9))
                )
                record[2] = int(end_time_JST.timestamp())

            output["id"] = record[0]
            output["start"] = record[1]
            output["end"] = record[2]
            output["status"] = record[3]

            print(json.dumps(output))
