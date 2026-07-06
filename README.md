# Part A - Discovery and ping

- Flash the TBR (Wi-Fi SoC—S3 or C3 target—followed by the ESP32-H2 RCP) and obtain an IP address
- Start the Thread network
- Flash the ESP32-H2 node using the `ot_cli` example and have it join the network.
- Verify connectivity by pinging the Border Router.

For this part, we'll only follow [this documentation](https://docs.espressif.com/projects/esp-thread-br/en/latest/dev-guide/build_and_run.html#build-and-run-the-thread-cli-device).

So firstly, set up the repositories:
```bash
git clone --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
git checkout v5.5.4
git submodule update --init --depth 1
./install.sh
. ./export.sh
cd ..
git clone --recursive https://github.com/espressif/esp-thread-br.git
```

Build the RCP Image :
```bash
cd $IDF_PATH/examples/openthread/ot_rcp
idf.py set-target esp32h2
idf.py build
```

Here we can connect the S3 and configure it to be ESP Thread Border Router:
```bash
cd esp-thread-br/examples/basic_thread_border_router
idf.py set-target esp32s3 # switch to YOUR model
idf.py menuconfig # we don't change anything since we don't need wi-fi connectivity
```

We can now run it and create the Thread network:
```bash
idf.py -p /dev/cu.usbmodem1301 flash monitor # change the device to match yours
# avoiding conflicts with others groups
ot channel 13 # set yours
ot panid 0x6776 # set yours
###
ot dataset init new
ot dataset commit active
ot ifconfig up
ot thread start
```

Now, build and run the Thread CLI Device:
```bash
cd $IDF_PATH/examples/openthread/ot_cli
idf.py -p ${PORT_TO_ESP32_H2} flash monitor
# avoiding conflicts with others groups
ot channel 13 # set yours
ot panid 0x7667 # set yours
###
```

Go on the TBR and get the network dataset:
```bash
ot dataset active -x
```

Copy the output chain and go back on the CLI:
```bash
ot dataset set active 0e080000000000010000000300001335060004001fffe00208dead00beef00cafe0708fdfaeb6813db063b0510112233445566778899aabbccddeeff00030f4f70656e5468726561642d34396436010212340410104810e2315100afd6bc9215a6bfac530c0402a0f7f8
ot dataset commit active
ot ifconfig up
ot thread start
```

The CLI should output that he became child (he also can be promoted to router)

We can end with a ping:
```bash
# On the TBR
esp32s3> ot ipaddr
fd60:87b9:9299:5927:0:ff:fe00:fc00
fd60:87b9:9299:5927:0:ff:fe00:dc00
fd60:87b9:9299:5927:157d:b8fd:145:2743
fe80:0:0:0:f896:5629:9634:cbb9
Done
###
# On the CLI
esp32h2> ot ping fd60:87b9:9299:5927:157d:b8fd:145:2743
16 bytes from fd60:87b9:9299:5927:157d:b8fd:145:2743: icmp_seq=2 hlim=255 time=71ms
1 packets transmitted, 1 packets received. Packet loss = 0.0%. Round-trip min/avg/max = 71/71.000/71 ms.
Done
###
```

