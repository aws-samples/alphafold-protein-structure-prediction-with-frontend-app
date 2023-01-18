#!/bin/bash

##########
# SlurmのHead Nodeプロビジョニング後に実行されるスクリプト
# 参考：https://github.com/aws-samples/aws-research-workshops/blob/mainline/notebooks/parallelcluster/scripts/pcluster_post_install_fast.sh
##########

echo "start running post process..."

#####
# install Docker following https://docs.docker.com/engine/install/ubuntu/
#####
echo "installing Docker..."
sudo apt-get remove docker docker-engine docker.io containerd runc
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
# install latest Docker Engine
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# prepare docker access priviledge
sudo systemctl status docker
echo "groupadd info..."
sudo groupadd docker
less /etc/group | grep docker
sudo usermod -aG docker ${USER}
newgrp docker
sudo systemctl restart docker
sudo chmod 666 /var/run/docker.sock
docker run hello-world

# install nvidia-container-toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
      && curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
      && curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
            sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
            sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
sudo systemctl restart dockerd
sudo docker run --rm --gpus all nvidia/cuda:11.6.2-base-ubuntu20.04 nvidia-smi

## install pip3
sudo apt-get install python3-pip -y
