FROM python:3
WORKDIR ./writ
COPY . .
RUN pip install --no-cache-dir -r dependencies.txt
EXPOSE 5000
CMD ["python3", "run.py"]
