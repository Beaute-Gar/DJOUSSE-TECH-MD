#include <jni.h>
#include <string>
#include <vector>
#include <node.h>

extern "C" JNIEXPORT jint JNICALL
Java_com_djoussetechnology_md_bot_NodeRunner_startNodeWithArguments(JNIEnv *env, jobject /* this */, jobjectArray arguments) {
    jsize argument_count = env->GetArrayLength(arguments);
    std::vector<std::string> arg_strings;
    std::vector<char*> argv;

    for (int i = 0; i < argument_count; i++) {
        jstring str = (jstring)env->GetObjectArrayElement(arguments, i);
        const char* s = env->GetStringUTFChars(str, 0);
        arg_strings.push_back(s);
        env->ReleaseStringUTFChars(str, s);
    }

    for (auto& s : arg_strings) {
        argv.push_back(&s[0]);
    }

    return node::Start(argument_count, argv.data());
}
