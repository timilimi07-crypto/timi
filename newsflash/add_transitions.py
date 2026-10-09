import re, shutil, sys, zipfile
src = sys.argv[1]; tmp = src + ".tmp"
zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
tr = '<p:transition spd="slow"><p:fade/></p:transition>'
for it in zin.infolist():
    d = zin.read(it.filename)
    if re.match(r"ppt/slides/slide\d+\.xml$", it.filename) and b"<p:transition" not in d:
        x = d.decode()
        x = x.replace("<p:timing", tr + "<p:timing", 1) if "<p:timing" in x else x.replace("</p:sld>", tr + "</p:sld>")
        d = x.encode()
    zout.writestr(it, d)
zout.close(); shutil.move(tmp, src)
