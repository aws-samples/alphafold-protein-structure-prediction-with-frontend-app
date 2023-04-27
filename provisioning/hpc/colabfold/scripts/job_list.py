import datetime
import json
import subprocess

keys = ["id", "start", "end", "status"]
output = {"error": "", "data": []}
stderr = ""

list_job_command = "sacct -S 'now-3days' -o JobID,Start,End,State -X"
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
        stderr += "There's no jobs to show"
        output["error"] = stderr
        print(json.dumps(output))

    else:
        for records in list_output.stdout.rstrip().split("\n")[2:]:
            record = records.split()

            # JST に変換
            # Status によっては starttime が "None" になる
            if record[1] != "None":
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

            # 2 つの配列から辞書を作成
            output["data"].append(dict(zip(keys, record)))
            for data in output["data"]:
                data["error"] = ""

        print(json.dumps(output))
