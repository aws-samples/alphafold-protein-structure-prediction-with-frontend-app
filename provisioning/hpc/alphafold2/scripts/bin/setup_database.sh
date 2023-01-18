#!/bin/bash

#####
# setup databases for AlphaFold2
#####
DOWNLOAD_DIR='/fsx/alphafold2/database'
PATH_TO_SETUP_LOG='/fsx/alphafold2/job/log/setup_database.out'
sudo apt-get update
sudo apt-get install aria2 -y
if [ ! -e ${DOWNLOAD_DIR} ]; then
    mkdir ${DOWNLOAD_DIR}
fi
echo 'Path to database setup job log: '${PATH_TO_SETUP_LOG}
echo 'This job runs in background after you logout from ssh. It takes a few hours to finish.'
nohup /fsx/alphafold2/alphafold/scripts/download_all_data.sh ${DOWNLOAD_DIR} > ${PATH_TO_SETUP_LOG} &
