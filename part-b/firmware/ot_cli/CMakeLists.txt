idf_component_register(SRCS "esp_ot_cli.c" "sensors.c"
                       INCLUDE_DIRS "."
                       REQUIRES json
                       PRIV_REQUIRES esp_event openthread nvs_flash
                       )
