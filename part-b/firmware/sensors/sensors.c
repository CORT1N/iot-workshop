#include <stdio.h>
#include <string.h>
#include <time.h>

#include "cJSON.h"
#include "esp_log.h"
#include "esp_openthread.h"
#include "esp_openthread_lock.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "openthread/instance.h"
#include "openthread/link.h"

static const char *TAG = "sensors";
static char g_node_id[17] = "0000000000000000";

static float pseudo_temp(int tick)
{
    return 21.5f + ((tick % 7) * 0.35f);
}

static float pseudo_humidity(int tick)
{
    return 45.0f + ((tick % 5) * 1.1f);
}

static int pseudo_rssi(int tick)
{
    return -42 - (tick % 6);
}

static void fill_node_id_from_extaddr(void)
{
    otInstance *ot_instance = esp_openthread_get_instance();
    if (ot_instance == NULL)
    {
        snprintf(g_node_id, sizeof(g_node_id), "%s", "0000000000000000");
        return;
    }

    esp_openthread_lock_acquire(portMAX_DELAY);

    const otExtAddress *ext = otLinkGetExtendedAddress(ot_instance);
    if (ext != NULL)
    {
        snprintf(g_node_id, sizeof(g_node_id), "%02X%02X%02X%02X%02X%02X%02X%02X", ext->m8[0], ext->m8[1], ext->m8[2],
                 ext->m8[3], ext->m8[4], ext->m8[5], ext->m8[6], ext->m8[7]);
    }
    else
    {
        snprintf(g_node_id, sizeof(g_node_id), "%s", "0000000000000000");
    }

    esp_openthread_lock_release();
}

static void sensors_task(void *pvParameters)
{
    int tick = 0;

    while (1)
    {
        if (strcmp(g_node_id, "0000000000000000") == 0)
        {
            fill_node_id_from_extaddr();
            ESP_LOGI(TAG, "Telemetry node_id=%s", g_node_id);
        }

        time_t now = time(NULL);

        cJSON *root = cJSON_CreateObject();
        if (root != NULL)
        {
            cJSON_AddStringToObject(root, "type", "telemetry");
            cJSON_AddStringToObject(root, "node_id", g_node_id);
            cJSON_AddNumberToObject(root, "temp", pseudo_temp(tick));
            cJSON_AddNumberToObject(root, "humidity", pseudo_humidity(tick));
            cJSON_AddNumberToObject(root, "rssi", pseudo_rssi(tick));
            cJSON_AddNumberToObject(root, "timestamp", (double)now);

            char *json = cJSON_PrintUnformatted(root);
            if (json != NULL)
            {
                printf("%s\n", json);
                fflush(stdout);
                cJSON_free(json);
            }

            cJSON_Delete(root);
        }

        tick++;
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void sensors_start(void)
{
    xTaskCreate(sensors_task, "sensors_task", 4096, NULL, 5, NULL);
}
