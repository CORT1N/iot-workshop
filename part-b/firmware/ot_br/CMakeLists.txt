idf_component_register(SRCS "esp_ot_br.c" "sensors.c"
                       INCLUDE_DIRS "."
                       EMBED_TXTFILES ${project_dir}/server_certs/ca_cert.pem
                       REQUIRES json
                       PRIV_REQUIRES esp_timer spiffs
                       )
