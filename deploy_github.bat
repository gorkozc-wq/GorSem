@echo off
set GIT_PATH="C:\Program Files\Git\bin\git.exe"

echo Temizlik yapiliyor...
if exist ".git\HEAD.lock" del ".git\HEAD.lock"
if exist ".git\index.lock" del ".git\index.lock"
if exist ".git\refs\heads\main.lock" del ".git\refs\heads\main.lock"

echo Git baslatiliyor...
%GIT_PATH% init
%GIT_PATH% add .
%GIT_PATH% commit -m "GorSem Otomatik Yukleme"
%GIT_PATH% branch -M main

echo Uzak sunucu ayarlaniyor...
%GIT_PATH% remote remove origin
%GIT_PATH% remote add origin https://github.com/gorkozc-wq/GorSem.git

echo GitHub'a gonderiliyor...
echo.
echo !!!!!!! DIKKAT !!!!!!!
echo Eger pencere acilirsa giris yapin.
echo Sifre sorulursa lutfen GitHub kullanici adi ve token/sifrenizi girin.
echo.
%GIT_PATH% push -u origin main

echo.
echo Islem bitti. Bir tusa basarak kapatabilirsiniz.
pause
