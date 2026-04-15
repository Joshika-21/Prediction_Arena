FROM mcr.microsoft.com/azure-functions/python:4-python3.11

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

COPY requirements.txt /home/site/wwwroot/requirements.txt
RUN cd /home/site/wwwroot && pip install -r requirements.txt

COPY . /home/site/wwwroot
