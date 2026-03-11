@echo off
title Auto Fetching Dashboard Data...
color 0A
mode con cols=80 lines=20

echo ==============================================
echo        Google Sheets Auto-Fetcher script
echo ==============================================
echo.
echo  Please minimize this window.
echo  It will fetch data only at 09:00 and 15:00.
echo.
echo ==============================================
echo.

:loop
echo [%time%] Checking time...

:: Check if it is currently 09:XX or 15:XX
set "hour=%time:~0,2%"
:: Remove leading space if hour is single digit
if "%hour:~0,1%" == " " set "hour=0%hour:~1,1%"

set "today=%date%"

:: If it's 09:XX and hasn't run today
if "%hour%" == "09" (
    if not "%HAS_RUN_09%" == "%today%" (
        echo ----------------------------------------------
        echo [%date% %time%] 09:00 Fetching data!
        echo ----------------------------------------------
        call node fetchData.js
        set "HAS_RUN_09=%today%"
        echo Done. Waiting for afternoon schedule.
    )
)

:: If it's 15:XX and hasn't run today
if "%hour%" == "15" (
    if not "%HAS_RUN_15%" == "%today%" (
        echo ----------------------------------------------
        echo [%date% %time%] 15:00 Fetching data!
        echo ----------------------------------------------
        call node fetchData.js
        set "HAS_RUN_15=%today%"
        echo Done. Waiting for tomorrow schedule.
    )
)

:: Sleep for 30 minutes before checking again
timeout /t 1800 /nobreak > nul

goto loop
