# Docker Container Stats
A web interface for viewing historical and current statistics per docker container (cpu, mem, net i/o, block i/o) - in a docker container.

Pull and run daemonized:
```
docker pull virtualzone/docker-container-stats
docker run \
        -d \
        -p 8080:8080 \
        --volume=/var/run/docker.sock:/var/run/docker.sock:ro \
        --volume=/home/docker/storage/stats/db:/opt/docker-stats/db \
        --name stats \
        -e STATS_UPDATE_INTERVAL=10 \
        virtualzone/docker-container-stats
```

Docker-Compose:

```
version: '3.6'
services:
  stats:
    image: virtualzone/docker-container-stats
    container_name: 'stats'
    ports:
      - '8080:8080'
    environment:
      STATS_UPDATE_INTERVAL: 10
    volumes:
      - '/var/run/docker.sock:/var/run/docker.sock:ro'
      - '/home/docker/storage/stats/db:/opt/docker-stats/db'
```


To view your stats, open a web browser and visit http://localhost:8080 (replace localhost with your docker host's hostname or ip address).

Mounting the volume /var/run/docker.sock (read-only) is required so that the docker container can retrieve the statistics for the containers.

Mounting the volume /opt/docker-stats/db is optional. You can use it if you want to persist the SQLite database.

We strongly recommend not making your stats available online. To password protect your statistics, you can use a frontend web server/proxy (Apache, nginx, ...).

## Screenshots
![All containers' memory usage](https://raw.githubusercontent.com/virtualzone/docker-container-stats/master/img/all-containers-mem.png)

![All containers' inbound network traffic](https://raw.githubusercontent.com/virtualzone/docker-container-stats/master/img/all-containers-net.png)

![Selected container's latest statistics](https://raw.githubusercontent.com/virtualzone/docker-container-stats/master/img/selected-container.png)
