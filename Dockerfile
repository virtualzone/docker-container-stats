FROM debian:jessie
MAINTAINER Heiner Peuser <heiner.peuser@weweave.net>

ENV LANG C.UTF-8
ENV HOME /root
ENV DEBIAN_FRONTEND noninteractive

RUN echo "deb http://debian-mirrors.sdinet.de/deb-multimedia stable main non-free" >> /etc/apt/sources.list
RUN apt-get update && apt-get install -y --force-yes \
    curl \
    supervisor \
    wget

RUN curl -sL https://deb.nodesource.com/setup_5.x | bash - && \
    apt-get install -y nodejs sqlite3

RUN curl -fsSL https://get.docker.com/ | sh

RUN cd /bin && \
    wget https://github.com/ohjames/smell-baron/releases/download/v0.3.0/smell-baron && \
    chmod a+x smell-baron

RUN mkdir /opt/docker-stats
RUN mkdir /opt/docker-stats/db

RUN cd /opt/docker-stats && \
    npm update && \
    npm install express sqlite3 body-parser moment

RUN apt-get clean
RUN rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ADD stats.js /opt/docker-stats/
ADD httpd.js /opt/docker-stats/
ADD html/ /opt/docker-stats/html/
ADD supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8080
ENTRYPOINT ["/bin/smell-baron"]
CMD ["/usr/bin/supervisord"]