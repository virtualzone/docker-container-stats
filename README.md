# Docker Container Stats
A web interface for viewing historical and current statistics per docker container (cpu, mem, net i/o, block i/o) - in a docker container.

Pull and run daemonized:
```
docker pull virtualzone/docker-container-stats
docker run \
        -d \
        -p 8080:8080 \
        --volume=/var/lib/docker/:/var/lib/docker:ro \
        --volume=/var/run/docker.sock:/var/run/docker.sock:ro \
        --volume=/home/docker/storage/stats/db:/opt/docker-stats/db \
        --name stats \
        virtualzone/docker-container-stats
```

Mounting the volumes /var/lib/docker and /var/run/docker.sock (read-only) is required so that the docker container can retrieve the statistics for the containers.

Mounting the volume /opt/docker-stats/db is optional. You can use it if you want to persist the SQLite database.

## Screenshots
![All containers' memory usage](https://raw.githubusercontent.com/virtualzone/docker-container-stats/master/img/all-containers-mem.png)

![All containers' inbound network traffic](https://raw.githubusercontent.com/virtualzone/docker-container-stats/master/img/all-containers-net.png)

![Selected container's latest statistics](https://raw.githubusercontent.com/virtualzone/docker-container-stats/master/img/selected-container.png)