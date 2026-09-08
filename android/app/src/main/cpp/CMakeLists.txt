cmake_minimum_required(VERSION 3.10.2)
project("native-lib")

# Use absolute paths to headers and libs
set(NODE_HEADERS_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../libnode/include/node")
set(NODE_LIB_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}")

message(STATUS "Node headers dir: ${NODE_HEADERS_DIR}")
message(STATUS "Node lib dir: ${NODE_LIB_DIR}")

# Include Node.js headers
include_directories(${NODE_HEADERS_DIR})

# Add the prebuilt Node.js library
add_library(nodejs-lib SHARED IMPORTED)
set_target_properties(nodejs-lib PROPERTIES IMPORTED_LOCATION
    ${NODE_LIB_DIR}/libnode.so)

# Create the native-lib bridge
add_library(native-lib SHARED native-lib.cpp)

# Link native-lib with nodejs-lib and android logging
target_link_libraries(native-lib nodejs-lib log)
