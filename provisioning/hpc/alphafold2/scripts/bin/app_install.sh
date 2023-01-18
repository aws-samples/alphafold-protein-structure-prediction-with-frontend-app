#!/bin/bash

#####
# /fsx 下の user:group 変更
#####
sudo chown -R ubuntu:ubuntu /fsx

#####
# download databases for AlphaFold2
#####
AFDIR='/fsx/alphafold2/'
cd $AFDIR
if [ ! -e ${AFDIR}alphafold ]; then
    git clone https://github.com/deepmind/alphafold.git
else echo 'AlphaFold already installed'
fi

#####
# create directory for AlphaFold2
#####
if [ ! -e ${AFDIR}job ]; then
    mkdir ${AFDIR}job
    mkdir ${AFDIR}job/input
    mkdir ${AFDIR}job/output
    mkdir ${AFDIR}job/log
fi