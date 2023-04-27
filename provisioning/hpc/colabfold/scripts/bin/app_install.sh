#####
# /fsx 下の user:group 変更
#####
sudo chown -R ubuntu:ubuntu /fsx

#####
# MMseqs2インストール
#####
rm -fr /fsx/mmseqs2
mkdir -p /fsx/mmseqs2/src
cd /fsx/mmseqs2/src
git clone --depth=1 https://github.com/soedinglab/MMseqs2.git
cd /fsx/mmseqs2/src/MMseqs2
mkdir build
cd build
cmake -DCMAKE_BUILD_TYPE=RELEASE -DHAVE_AVX2=1 -DHAVE_MPI=0 -DCMAKE_INSTALL_PREFIX=/fsx/mmseqs2/ ..
make -j 4
make install
echo "export PATH=\$PATH:/fsx/mmseqs2/bin" >> /home/ubuntu/.bashrc

#####
# vmtouch インストール
#####
rm -fr /fsx/vmtouch
cd /fsx
git clone https://github.com/hoytech/vmtouch.git
cd vmtouch
make
sudo make install

#####
# ColabFold インストール
#####
cd /fsx/colabfold
wget https://raw.githubusercontent.com/YoshitakaMo/localcolabfold/main/install_colabbatch_linux.sh
bash install_colabbatch_linux.sh
mkdir -p /fsx/colabfold/job

wget -q -P /fsx/colabfold/scripts/bin/ https://raw.githubusercontent.com/sokrypton/ColabFold/main/setup_databases.sh
chmod u+x /fsx/colabfold/scripts/bin/setup_databases.sh

