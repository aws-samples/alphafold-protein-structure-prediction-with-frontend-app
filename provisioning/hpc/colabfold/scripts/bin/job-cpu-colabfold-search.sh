#!/bin/sh
#SBATCH -n 16
#SBATCH -N 1

export PATH="/fsx/colabfold/localcolabfold/colabfold-conda/bin:/fsx/mmseqs2/bin:${PATH}"

# vmtouch
cd /fsx/vmtouch
sudo make install

# メモリにDBのデータを読み込む(vmtouch)
cd /fsx/colabfold/database/
sudo vmtouch -f -w -t -l -d -m 1000G *.idx

# colabfold_searchを実行
cd /home/ubuntu
JOBROOT=/fsx/colabfold
UNIREFDB=uniref30_2202_db
DB_PATH=/fsx/colabfold/database/

# $1: FASTAファイルへのフルパス, $2: 生成するmsasファイルの置き場（mktempで作った一時フォルダ）
colabfold_search --db1=$UNIREFDB $1 $DB_PATH/ $2
