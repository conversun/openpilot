#pragma once

#include <QDateTime>
#include <QDir>
#include <QDirIterator>

#include "frogpilot/ui/qt/widgets/frogpilot_controls.h"

// cn-mazda fork: "states" tab repurposed as Chinese province selector.
// Codes match keys in frogpilot/navigation/mapd_download_menu.json (cn_province section).
// Display strings use "English 中文" for clarity in the FrogPilot maps panel.
inline QMap<QString, QString> northChinaMap = {
  {"BJ", "Beijing 北京"}, {"TJ", "Tianjin 天津"}, {"HE", "Hebei 河北"},
  {"SX", "Shanxi 山西"}, {"NM", "Inner Mongolia 内蒙古"}
};

inline QMap<QString, QString> northeastChinaMap = {
  {"LN", "Liaoning 辽宁"}, {"JL", "Jilin 吉林"}, {"HL", "Heilongjiang 黑龙江"}
};

inline QMap<QString, QString> eastChinaMap = {
  {"SH", "Shanghai 上海"}, {"JS", "Jiangsu 江苏"}, {"ZJ", "Zhejiang 浙江"},
  {"AH", "Anhui 安徽"}, {"FJ", "Fujian 福建"}, {"JX", "Jiangxi 江西"},
  {"SD", "Shandong 山东"}, {"TW", "Taiwan 台湾"}
};

inline QMap<QString, QString> southCentralChinaMap = {
  {"HA", "Henan 河南"}, {"HB", "Hubei 湖北"}, {"HN", "Hunan 湖南"},
  {"GD", "Guangdong 广东"}, {"GX", "Guangxi 广西"}, {"HI", "Hainan 海南"},
  {"HK", "Hong Kong 香港"}, {"MO", "Macao 澳门"}
};

inline QMap<QString, QString> southwestChinaMap = {
  {"CQ", "Chongqing 重庆"}, {"SC", "Sichuan 四川"}, {"GZ", "Guizhou 贵州"},
  {"YN", "Yunnan 云南"}, {"XZ", "Tibet 西藏"}
};

inline QMap<QString, QString> northwestChinaMap = {
  {"SN", "Shaanxi 陕西"}, {"GS", "Gansu 甘肃"}, {"QH", "Qinghai 青海"},
  {"NX", "Ningxia 宁夏"}, {"XJ", "Xinjiang 新疆"}
};

inline QMap<QString, QString> africaMap = {
  {"DZ", "Algeria"}, {"AO", "Angola"}, {"BJ", "Benin"},
  {"BW", "Botswana"}, {"BF", "Burkina Faso"}, {"BI", "Burundi"},
  {"CM", "Cameroon"}, {"CF", "Central African Republic"}, {"TD", "Chad"},
  {"KM", "Comoros"}, {"CG", "Congo (Brazzaville)"}, {"CD", "Congo (Kinshasa)"},
  {"DJ", "Djibouti"}, {"EG", "Egypt"}, {"GQ", "Equatorial Guinea"},
  {"ER", "Eritrea"}, {"ET", "Ethiopia"}, {"GA", "Gabon"},
  {"GM", "Gambia"}, {"GH", "Ghana"}, {"GN", "Guinea"},
  {"GW", "Guinea-Bissau"}, {"CI", "Ivory Coast"}, {"KE", "Kenya"},
  {"LS", "Lesotho"}, {"LR", "Liberia"}, {"LY", "Libya"},
  {"MG", "Madagascar"}, {"MW", "Malawi"}, {"ML", "Mali"},
  {"MR", "Mauritania"}, {"MA", "Morocco"}, {"MZ", "Mozambique"},
  {"NA", "Namibia"}, {"NE", "Niger"}, {"NG", "Nigeria"},
  {"RW", "Rwanda"}, {"SN", "Senegal"}, {"SL", "Sierra Leone"},
  {"SO", "Somalia"}, {"ZA", "South Africa"}, {"SS", "South Sudan"},
  {"SD", "Sudan"}, {"SZ", "Swaziland"}, {"TZ", "Tanzania"},
  {"TG", "Togo"}, {"TN", "Tunisia"}, {"UG", "Uganda"},
  {"ZM", "Zambia"}, {"ZW", "Zimbabwe"}
};

inline QMap<QString, QString> antarcticaMap = {
  {"AQ", "Antarctica"}
};

inline QMap<QString, QString> asiaMap = {
  {"AF", "Afghanistan"}, {"AM", "Armenia"}, {"AZ", "Azerbaijan"},
  {"BH", "Bahrain"}, {"BD", "Bangladesh"}, {"BT", "Bhutan"},
  {"BN", "Brunei"}, {"KH", "Cambodia"}, {"CN", "China"},
  {"CY", "Cyprus"}, {"TL", "East Timor"}, {"HK", "Hong Kong"},
  {"IN", "India"}, {"ID", "Indonesia"}, {"IR", "Iran"},
  {"IQ", "Iraq"}, {"IL", "Israel"}, {"JP", "Japan"},
  {"JO", "Jordan"}, {"KZ", "Kazakhstan"}, {"KW", "Kuwait"},
  {"KG", "Kyrgyzstan"}, {"LA", "Laos"}, {"LB", "Lebanon"},
  {"MY", "Malaysia"}, {"MV", "Maldives"}, {"MO", "Macao"},
  {"MN", "Mongolia"}, {"MM", "Myanmar"}, {"NP", "Nepal"},
  {"KP", "North Korea"}, {"OM", "Oman"}, {"PK", "Pakistan"},
  {"PS", "Palestine"}, {"PH", "Philippines"}, {"QA", "Qatar"},
  {"RU", "Russia"}, {"SA", "Saudi Arabia"}, {"SG", "Singapore"},
  {"KR", "South Korea"}, {"LK", "Sri Lanka"}, {"SY", "Syria"},
  {"TW", "Taiwan"}, {"TJ", "Tajikistan"}, {"TH", "Thailand"},
  {"TR", "Turkey"}, {"TM", "Turkmenistan"}, {"AE", "United Arab Emirates"},
  {"UZ", "Uzbekistan"}, {"VN", "Vietnam"}, {"YE", "Yemen"}
};

inline QMap<QString, QString> europeMap = {
  {"AL", "Albania"}, {"AT", "Austria"}, {"BY", "Belarus"},
  {"BE", "Belgium"}, {"BA", "Bosnia and Herzegovina"}, {"BG", "Bulgaria"},
  {"HR", "Croatia"}, {"CZ", "Czech Republic"}, {"DK", "Denmark"},
  {"EE", "Estonia"}, {"FI", "Finland"}, {"FR", "France"},
  {"GE", "Georgia"}, {"DE", "Germany"}, {"GR", "Greece"},
  {"HU", "Hungary"}, {"IS", "Iceland"}, {"IE", "Ireland"},
  {"IT", "Italy"}, {"KZ", "Kazakhstan"}, {"LV", "Latvia"},
  {"LT", "Lithuania"}, {"LU", "Luxembourg"}, {"MK", "Macedonia"},
  {"MD", "Moldova"}, {"ME", "Montenegro"}, {"NL", "Netherlands"},
  {"NO", "Norway"}, {"PL", "Poland"}, {"PT", "Portugal"},
  {"RO", "Romania"}, {"RS", "Serbia"}, {"SK", "Slovakia"},
  {"SI", "Slovenia"}, {"ES", "Spain"}, {"SE", "Sweden"},
  {"CH", "Switzerland"}, {"TR", "Turkey"}, {"UA", "Ukraine"},
  {"GB", "United Kingdom"}
};

inline QMap<QString, QString> northAmericaMap = {
  {"BS", "Bahamas"}, {"BZ", "Belize"}, {"CA", "Canada"},
  {"CR", "Costa Rica"}, {"CU", "Cuba"}, {"DO", "Dominican Republic"},
  {"SV", "El Salvador"}, {"GL", "Greenland"}, {"GD", "Grenada"},
  {"GT", "Guatemala"}, {"HT", "Haiti"}, {"HN", "Honduras"},
  {"JM", "Jamaica"}, {"MX", "Mexico"}, {"NI", "Nicaragua"},
  {"PA", "Panama"}, {"TT", "Trinidad and Tobago"}, {"US", "United States"}
};

inline QMap<QString, QString> oceaniaMap = {
  {"AU", "Australia"}, {"FJ", "Fiji"}, {"TF", "French Southern Territories"},
  {"NC", "New Caledonia"}, {"NZ", "New Zealand"}, {"PG", "Papua New Guinea"},
  {"SB", "Solomon Islands"}, {"VU", "Vanuatu"}
};

inline QMap<QString, QString> southAmericaMap = {
  {"AR", "Argentina"}, {"BO", "Bolivia"}, {"BR", "Brazil"},
  {"CL", "Chile"}, {"CO", "Colombia"}, {"EC", "Ecuador"},
  {"FK", "Falkland Islands"}, {"GY", "Guyana"}, {"PY", "Paraguay"},
  {"PE", "Peru"}, {"SR", "Suriname"}, {"UY", "Uruguay"},
  {"VE", "Venezuela"}
};

inline QString calculateDirectorySize(const QDir &directory) {
  constexpr double MB = 1024.0 * 1024.0;
  constexpr double GB = 1024.0 * MB;

  if (!directory.exists()) {
    return QObject::tr("0 MB");
  }

  double totalSize = 0;
  QDirIterator it(directory.absolutePath(), QDir::Files, QDirIterator::Subdirectories);
  while (it.hasNext()) {
    it.next();
    totalSize += it.fileInfo().size();
  }

  if (totalSize >= GB) {
    return QString::number(totalSize / GB, 'f', 2) + QObject::tr(" GB");
  }
  return QString::number(totalSize / MB, 'f', 2) + QObject::tr(" MB");
}

inline QString daySuffix(int day) {
  if (day % 10 == 1 && day != 11) return "st";
  if (day % 10 == 2 && day != 12) return "nd";
  if (day % 10 == 3 && day != 13) return "rd";
  return "th";
}

inline QString formatCurrentDate() {
  QDate currentDate = QDate::currentDate();
  return currentDate.toString("MMMM d'") + daySuffix(currentDate.day()) + QString(", %1").arg(currentDate.year());
}

inline QString formatElapsedTime(float elapsedMilliseconds) {
  int totalSeconds = elapsedMilliseconds / 1000;
  int hours = totalSeconds / 3600;
  int minutes = (totalSeconds % 3600) / 60;
  int seconds = totalSeconds % 60;

  QString formattedTime;
  if (hours > 0) {
    formattedTime += QString::number(hours) + (hours == 1 ? QObject::tr(" hour ") : QObject::tr(" hours "));
  }
  if (minutes > 0) {
    formattedTime += QString::number(minutes) + (minutes == 1 ? QObject::tr(" minute ") : QObject::tr(" minutes "));
  }
  formattedTime += QString::number(seconds) + (seconds == 1 ? QObject::tr(" second") : QObject::tr(" seconds"));

  return formattedTime.trimmed();
}

inline QString formatETA(float elapsedTime, int downloadedFiles, int previousDownloadedFiles, int totalFiles, QDateTime &startTime) {
  static QDateTime estimatedFinishTime;

  static float previousElapsedTime;

  if (downloadedFiles != previousDownloadedFiles) {
    estimatedFinishTime = startTime.addMSecs((elapsedTime * totalFiles) / downloadedFiles);
  } else {
    estimatedFinishTime = estimatedFinishTime.addSecs((previousElapsedTime - elapsedTime) / 1000);
  }
  previousElapsedTime = elapsedTime;

  int remainingTime = QDateTime::currentDateTime().secsTo(estimatedFinishTime);

  QString estimatedFinishTimeStr = estimatedFinishTime.toString("h:mm AP");
  QString remainingTimeStr = formatElapsedTime(remainingTime * 1000);

  return QString("%1 (%2)").arg(remainingTimeStr).arg(estimatedFinishTimeStr);
}

class MapSelectionControl : public QWidget {
  Q_OBJECT

public:
  MapSelectionControl(const QMap<QString, QString> &map, bool isCountry = false);

private:
  void loadSelectedMaps();
  void updateSelectedMaps();

  Params params;

  QButtonGroup *mapButtons;

  QString selectionType;
};
