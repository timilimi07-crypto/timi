# Fügt jeder Folie einen Morph-Übergang hinzu (Fallback: Überblenden). Keynote macht daraus "Zauberei".
import re, shutil, sys, zipfile
src = sys.argv[1]; tmp = src + ".tmp"
tr = ('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
      '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">'
      '<p:transition spd="slow"><p159:morph option="byObject"/></p:transition></mc:Choice>'
      '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')
zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    d = zin.read(it.filename)
    if re.match(r"ppt/slides/slide\d+\.xml$", it.filename) and b"p159:morph" not in d:
        x = d.decode()
        x = x.replace("<p:timing", tr + "<p:timing", 1) if "<p:timing" in x else x.replace("</p:sld>", tr + "</p:sld>")
        d = x.encode()
    zout.writestr(it, d)
zout.close(); shutil.move(tmp, src)
